"""
Epic Grooming Agent — LangGraph state machine with conditional self-correction.

Pipeline:
    titles ──► criteria ──► validate ──► router ──► rice ──► persist
                  ▲                         │
                  └──── retry (≤2) ─────────┘  (when issues detected)

The `validate` + `router` nodes turn this from a static pipeline into a true
agent: the model decides whether the generated stories are good enough or
should be regenerated with explicit feedback.
"""

from __future__ import annotations

from typing import Literal, TypedDict

from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field

from app.agents.llm import get_structured_llm
from app.api.prioritization import _read_backlog, _write_backlog
from app.prioritization.algorithms import Feature


MAX_RETRIES = 2


# ── Public IO ────────────────────────────────────────────────────────────────

class GroomingRequest(BaseModel):
    epic: str = Field(..., min_length=5)
    num_stories: int = Field(default=5, ge=1, le=10)
    persist: bool = True


class GeneratedStory(BaseModel):
    title: str
    as_a: str = ""
    i_want: str = ""
    so_that: str = ""
    acceptance_criteria: list[str] = []
    reach: float = 5.0
    impact: float = 5.0
    confidence: float = 0.7
    effort: float = 3.0
    tags: list[str] = []


class ValidationIssue(BaseModel):
    story_index: int
    problem: str
    suggestion: str


class AgentStep(BaseModel):
    """One transparent step the agent took — used for UI traces."""
    node: str
    verdict: str = ""
    issues: list[ValidationIssue] = []
    note: str = ""


class GroomingResponse(BaseModel):
    epic: str
    stories: list[GeneratedStory]
    persisted_ids: list[str] = []
    trace: list[AgentStep] = []
    retries: int = 0


# ── Internal step schemas ────────────────────────────────────────────────────

class _TitleList(BaseModel):
    titles: list[str]


class _StoriesWithCriteria(BaseModel):
    stories: list[GeneratedStory]


class _RiceList(BaseModel):
    stories: list[GeneratedStory]


class _Validation(BaseModel):
    verdict: Literal["ok", "retry"]
    issues: list[ValidationIssue] = []
    summary: str = ""


class _State(TypedDict, total=False):
    epic: str
    num_stories: int
    persist: bool
    stories: list[GeneratedStory]
    persisted_ids: list[str]
    feedback: list[ValidationIssue]
    retry_count: int
    trace: list[AgentStep]


# ── Nodes ────────────────────────────────────────────────────────────────────

def _node_titles(state: _State) -> _State:
    # Stage 1: generate short user-story titles to keep the downstream prompt
    # focused and reduce the chance of overlong stories.
    llm = get_structured_llm(_TitleList, model="gpt-4o")
    result: _TitleList = llm.invoke(
        f"Generate {state['num_stories']} concise user-story titles for this epic:\n"
        f"\"{state['epic']}\"\nReturn only the titles."
    )
    state["stories"] = [GeneratedStory(title=t) for t in result.titles[: state["num_stories"]]]
    state.setdefault("trace", []).append(
        AgentStep(node="titles", note=f"Generated {len(state['stories'])} titles")
    )
    return state


def _node_criteria(state: _State) -> _State:
    # Stage 2: expand each title into a concrete story with acceptance criteria.
    llm = get_structured_llm(_StoriesWithCriteria, model="gpt-4o")
    titles = [s.title for s in state["stories"]]

    feedback_block = ""
    feedback = state.get("feedback") or []
    if feedback:
        feedback_block = (
            "\n\nThe previous attempt had quality issues. Address EACH of them:\n"
            + "\n".join(
                f"- story #{i.story_index} "
                f"({titles[i.story_index] if 0 <= i.story_index < len(titles) else '?'}): "
                f"{i.problem} → {i.suggestion}"
                for i in feedback
            )
            + "\n"
        )

    prompt = (
        f"Epic: \"{state['epic']}\"\n\n"
        f"For each of these user-story titles, fill in:\n"
        f"- as_a (the role — be specific, never \"user\")\n"
        f"- i_want (the goal — concrete action)\n"
        f"- so_that (the business/user benefit)\n"
        f"- acceptance_criteria (exactly 3 TESTABLE Given/When/Then-style criteria, "
        f"no vague words like \"user-friendly\" or \"fast\")\n"
        f"- tags (1-3 short tags)\n\n"
        f"Keep reach/impact/confidence/effort at defaults."
        f"{feedback_block}\n"
        f"Titles:\n" + "\n".join(f"- {t}" for t in titles)
    )
    result: _StoriesWithCriteria = llm.invoke(prompt)
    by_title = {s.title.strip().lower(): s for s in result.stories}
    merged: list[GeneratedStory] = []
    for original in state["stories"]:
        match = by_title.get(original.title.strip().lower())
        merged.append(match if match else original)
    state["stories"] = merged
    state.setdefault("trace", []).append(
        AgentStep(
            node="criteria",
            note=f"Filled criteria (attempt {state.get('retry_count', 0) + 1})"
            + (f" with {len(feedback)} feedback items" if feedback else ""),
        )
    )
    return state


_VALIDATE_SYSTEM = """You are a strict Agile coach reviewing user stories against INVEST + acceptance-criteria quality.

Reject ("retry") if ANY of:
- as_a is missing, empty, or generic ("user", "someone")
- i_want or so_that is missing or empty
- acceptance_criteria has fewer than 3 items
- any acceptance criterion uses vague words: "user-friendly", "fast", "easy", "intuitive", "robust", "good", "nice"
- criteria are not testable (no concrete behavior / output)

Approve ("ok") only when every story passes all checks.
For each issue, return: story_index (0-based), problem, suggestion (one short sentence)."""


def _node_validate(state: _State) -> _State:
    # Stage 3: validate the generated stories against INVEST-style quality rules.
    llm = get_structured_llm(_Validation, model="gpt-4o")
    payload = [
        {
            "index": i,
            "title": s.title,
            "as_a": s.as_a,
            "i_want": s.i_want,
            "so_that": s.so_that,
            "acceptance_criteria": s.acceptance_criteria,
        }
        for i, s in enumerate(state["stories"])
    ]
    result: _Validation = llm.invoke([
        {"role": "system", "content": _VALIDATE_SYSTEM},
        {"role": "user", "content": f"Review these stories and return verdict + issues:\n{payload}"},
    ])
    state["feedback"] = result.issues
    state.setdefault("trace", []).append(
        AgentStep(
            node="validate",
            verdict=result.verdict,
            issues=result.issues,
            note=result.summary or f"{len(result.issues)} issue(s) found",
        )
    )
    return state


def _route_after_validate(state: _State) -> str:
    # Retry only if the validator found real issues and we still have budget.
    retries = state.get("retry_count", 0)
    issues = state.get("feedback") or []
    trace = state.get("trace", [])
    verdict = trace[-1].verdict if trace else "ok"

    if verdict == "ok" or not issues:
        return "rice"
    if retries >= MAX_RETRIES:
        state.setdefault("trace", []).append(
            AgentStep(node="router", note=f"Max retries ({MAX_RETRIES}) reached — proceeding anyway")
        )
        return "rice"
    state["retry_count"] = retries + 1
    state.setdefault("trace", []).append(
        AgentStep(node="router", note=f"Retry #{state['retry_count']} → regenerate criteria")
    )
    return "criteria"


def _node_rice(state: _State) -> _State:
    # Stage 4: estimate effort and value inputs after the story text is stable.
    llm = get_structured_llm(_RiceList, model="mistral-large")
    payload = [
        {"title": s.title, "as_a": s.as_a, "i_want": s.i_want, "so_that": s.so_that}
        for s in state["stories"]
    ]
    prompt = (
        "For each user story below, estimate RICE inputs as a senior PO:\n"
        "- reach: 0-10 (how many users impacted)\n"
        "- impact: 0-10 (benefit per user)\n"
        "- confidence: 0.1-1.0 (estimate certainty)\n"
        "- effort: 0.5-20 (dev weeks)\n"
        "Keep title and all other fields identical to the input.\n\n"
        f"Stories: {payload}"
    )
    note = "RICE estimated via Mistral"
    try:
        result: _RiceList = llm.invoke(prompt)
        by_title = {s.title.strip().lower(): s for s in result.stories}
        for s in state["stories"]:
            est = by_title.get(s.title.strip().lower())
            if est:
                s.reach = est.reach
                s.impact = est.impact
                s.confidence = est.confidence
                s.effort = est.effort
                if est.tags:
                    s.tags = est.tags
    except Exception as exc:
        note = f"Mistral unavailable, kept defaults ({exc.__class__.__name__})"
    state.setdefault("trace", []).append(AgentStep(node="rice", note=note))
    return state


def _node_persist(state: _State) -> _State:
    if not state.get("persist"):
        state["persisted_ids"] = []
        state.setdefault("trace", []).append(AgentStep(node="persist", note="Skipped (persist=False)"))
        return state
    existing = _read_backlog()
    new_features: list[Feature] = []
    for s in state["stories"]:
        f = Feature(
            name=s.title,
            description=f"As a {s.as_a}, I want {s.i_want}, so that {s.so_that}.\n\n"
                        + "Acceptance criteria:\n" + "\n".join(f"- {c}" for c in s.acceptance_criteria),
            epic=state["epic"],
            tags=s.tags,
            reach=s.reach,
            impact=s.impact,
            confidence=max(0.1, min(s.confidence, 1.0)),
            effort=max(0.5, min(s.effort, 20.0)),
        )
        new_features.append(f)
    _write_backlog(existing + new_features)
    state["persisted_ids"] = [f.id for f in new_features]
    state.setdefault("trace", []).append(
        AgentStep(node="persist", note=f"Persisted {len(new_features)} features to backlog")
    )
    return state


# ── Graph factory ────────────────────────────────────────────────────────────

def _build_graph():
    graph = StateGraph(_State)
    graph.add_node("titles", _node_titles)
    graph.add_node("criteria", _node_criteria)
    graph.add_node("validate", _node_validate)
    graph.add_node("rice", _node_rice)
    graph.add_node("persist", _node_persist)

    graph.set_entry_point("titles")
    graph.add_edge("titles", "criteria")
    graph.add_edge("criteria", "validate")
    graph.add_conditional_edges(
        "validate", _route_after_validate, {"criteria": "criteria", "rice": "rice"}
    )
    graph.add_edge("rice", "persist")
    graph.add_edge("persist", END)
    return graph.compile()


_GRAPH = None


def groom_epic(req: GroomingRequest) -> GroomingResponse:
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = _build_graph()
    final_state: _State = _GRAPH.invoke({
        "epic": req.epic,
        "num_stories": req.num_stories,
        "persist": req.persist,
        "stories": [],
        "persisted_ids": [],
        "feedback": [],
        "retry_count": 0,
        "trace": [],
    })
    return GroomingResponse(
        epic=req.epic,
        stories=final_state.get("stories", []),
        persisted_ids=final_state.get("persisted_ids", []),
        trace=final_state.get("trace", []),
        retries=final_state.get("retry_count", 0),
    )
