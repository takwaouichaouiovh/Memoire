"""
Supervisor LangGraph — orchestrates the full PO workflow from a single prompt.

A PO can say: *"Prepare next sprint for epic 'SSO multi-tenant', velocity 30"*
and the supervisor decides which sub-agents to call, in which order, and how
to compose their outputs into a final, demo-ready report.

Topology (conditional, not linear):

                ┌─────────────┐
                │  supervisor │◄─────────────────────────────┐
                └──────┬──────┘                              │
              route_to_next                                  │
                       │                                     │
        ┌──────────────┼───────────────┬─────────────┐       │
        ▼              ▼               ▼             ▼       │
    grooming     prioritization     planner       summary ───┘
        │              │               │             │
        └──────────────┴───────────────┴─────────────┘
                            │
                          (END)

The supervisor is rule-based by default (deterministic, cheap, easy to defend
in a thesis methodology chapter). An LLM-routed variant can be enabled with
``use_llm_router=True`` if richer dispatch is desired.

Every node appends to ``trace`` so the frontend can render a step-by-step log
(mirrors the existing grooming agent UX).
"""

from __future__ import annotations

from typing import Any, Literal, TypedDict

from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field

from app.agents.grooming import GroomingRequest, groom_epic
from app.agents.llm import get_structured_llm
from app.api.prioritization import _read_backlog
from app.prioritization.algorithms import AlgoName, Feature, prioritize
from app.prioritization.dependency_planner import (
    DependencyPlanRequest,
    DependencySprintPlan,
    plan_sprint_with_dependencies,
)


# ── Public IO ────────────────────────────────────────────────────────────────

class SupervisorRequest(BaseModel):
    goal: str = Field(..., min_length=4, description="High-level PO goal in natural language")
    epic: str = Field(default="", description="Optional epic text to groom into stories first")
    velocity: float = Field(default=20.0, gt=0)
    algorithm: AlgoName = "rice"
    use_ai_blend: bool = False
    respect_dependencies: bool = True
    persist_groomed_stories: bool = False
    use_llm_router: bool = Field(
        default=False,
        description="If true, an LLM picks each next step. If false, deterministic routing.",
    )


class SupervisorStep(BaseModel):
    node: str
    decision: str = ""
    note: str = ""
    payload: dict[str, Any] = Field(default_factory=dict)


class SupervisorResponse(BaseModel):
    goal: str
    summary: str = ""
    sprint_plan: DependencySprintPlan | None = None
    groomed_story_count: int = 0
    trace: list[SupervisorStep] = Field(default_factory=list)
    iterations: int = 0


# ── Graph state ──────────────────────────────────────────────────────────────

class _State(TypedDict, total=False):
    goal: str
    epic: str
    velocity: float
    algorithm: AlgoName
    use_ai_blend: bool
    respect_dependencies: bool
    persist_groomed_stories: bool
    use_llm_router: bool
    # working data
    features: list[Feature]
    groomed_count: int
    sprint_plan: DependencySprintPlan | None
    summary: str
    # control
    completed: set[str]
    iterations: int
    trace: list[SupervisorStep]


_MAX_ITERATIONS = 8
_NEXT_OPTIONS = ("grooming", "prioritization", "planner", "summary", "done")


# ── Router ───────────────────────────────────────────────────────────────────

class _RouteDecision(BaseModel):
    next: Literal["grooming", "prioritization", "planner", "summary", "done"]
    reason: str = ""


def _deterministic_route(state: _State) -> _RouteDecision:
    # Keep the default path deterministic so the demo stays predictable and
    # cheap; only use the LLM router when the user explicitly opts in.
    done = state.get("completed", set())
    if state.get("epic") and "grooming" not in done:
        return _RouteDecision(next="grooming", reason="epic provided, needs grooming first")
    if "planner" not in done:
        # prioritization is implicit inside the planner, but if the user
        # explicitly cares about ranks we can surface it. Keep it for
        # transparency in the trace:
        if "prioritization" not in done:
            return _RouteDecision(next="prioritization", reason="rank backlog before planning")
        return _RouteDecision(next="planner", reason="produce sprint plan")
    if "summary" not in done:
        return _RouteDecision(next="summary", reason="compose final brief")
    return _RouteDecision(next="done", reason="all stages completed")


def _llm_route(state: _State) -> _RouteDecision:
    done = sorted(state.get("completed", set()))
    context = {
        "goal": state.get("goal", ""),
        "has_epic": bool(state.get("epic")),
        "completed_steps": done,
        "n_features": len(state.get("features", [])),
        "has_plan": state.get("sprint_plan") is not None,
    }
    llm = get_structured_llm(_RouteDecision, model="gpt-4o")
    return llm.invoke(
        "You are a supervisor coordinating Product Owner sub-agents.\n"
        "Available next steps: grooming (split an epic into stories), "
        "prioritization (rank the backlog), planner (build a sprint plan "
        "respecting dependencies), summary (write a one-paragraph brief), "
        "done.\n"
        "Pick exactly one next step that best advances the goal. Avoid repeating "
        "steps already completed unless absolutely necessary.\n"
        f"Context: {context}"
    )


def _node_supervisor(state: _State) -> _State:
    # One supervisor step decides the next node, then we record that decision
    # so the trace can be shown in the UI.
    state["iterations"] = state.get("iterations", 0) + 1
    if state["iterations"] > _MAX_ITERATIONS:
        decision = _RouteDecision(next="done", reason="iteration cap reached")
    else:
        decision = (
            _llm_route(state) if state.get("use_llm_router") else _deterministic_route(state)
        )
    state.setdefault("trace", []).append(
        SupervisorStep(node="supervisor", decision=decision.next, note=decision.reason)
    )
    # stash decision on state for conditional edge
    state["_next"] = decision.next  # type: ignore[typeddict-item]
    return state


def _route_after_supervisor(state: _State) -> str:
    nxt = state.get("_next", "done")  # type: ignore[arg-type]
    return nxt if nxt in _NEXT_OPTIONS else "done"


# ── Worker nodes ─────────────────────────────────────────────────────────────

def _node_grooming(state: _State) -> _State:
    # If an epic is provided, we generate stories first so the rest of the
    # pipeline can work on smaller, structured items.
    try:
        result = groom_epic(
            GroomingRequest(
                epic=state["epic"],
                num_stories=5,
                persist=bool(state.get("persist_groomed_stories")),
            )
        )
        state["groomed_count"] = len(result.stories)
        # If we persisted, the new stories are now in backlog.json. Otherwise,
        # surface them as ephemeral Feature objects appended to working set.
        if not state.get("persist_groomed_stories"):
            extra = [
                Feature(
                    name=s.title,
                    description=(
                        f"As a {s.as_a}, I want {s.i_want}, so that {s.so_that}."
                    ),
                    epic=state["epic"],
                    tags=s.tags,
                    reach=s.reach,
                    impact=s.impact,
                    confidence=max(0.1, min(s.confidence, 1.0)),
                    effort=max(0.5, min(s.effort, 20.0)),
                )
                for s in result.stories
            ]
            state["features"] = list(state.get("features", [])) + extra
        state.setdefault("trace", []).append(
            SupervisorStep(
                node="grooming",
                note=f"Generated {len(result.stories)} stories (retries={result.retries})",
                payload={"stories": [s.title for s in result.stories]},
            )
        )
    except Exception as exc:
        state.setdefault("trace", []).append(
            SupervisorStep(node="grooming", note=f"failed: {exc.__class__.__name__}: {exc}")
        )
    state.setdefault("completed", set()).add("grooming")
    return state


def _node_prioritization(state: _State) -> _State:
    # Prioritization is run here mostly for transparency: it lets the user see
    # the sorted backlog before the actual sprint planner selects items.
    features = state.get("features") or _read_backlog()
    state["features"] = features
    scored = prioritize(features, state.get("algorithm", "rice"), state.get("use_ai_blend", False))
    top = [{"name": s.feature.name, "score": round(s.final_score, 1)} for s in scored[:5]]
    state.setdefault("trace", []).append(
        SupervisorStep(
            node="prioritization",
            note=f"Ranked {len(scored)} features ({state.get('algorithm', 'rice')})",
            payload={"top5": top},
        )
    )
    state.setdefault("completed", set()).add("prioritization")
    return state


def _node_planner(state: _State) -> _State:
    # The planner consumes the full feature set and respects dependencies when
    # requested. The solver choice is surfaced in the trace for explainability.
    features = state.get("features") or _read_backlog()
    state["features"] = features
    plan = plan_sprint_with_dependencies(
        DependencyPlanRequest(
            features=features,
            velocity=state.get("velocity", 20.0),
            algorithm=state.get("algorithm", "rice"),
            use_ai_blend=state.get("use_ai_blend", False),
            solver="auto" if state.get("respect_dependencies", True) else "greedy",
        )
    )
    state["sprint_plan"] = plan
    state.setdefault("trace", []).append(
        SupervisorStep(
            node="planner",
            note=(
                f"{plan.solver} solver "
                f"(optimal={plan.optimal}) — selected {len(plan.selected)}, "
                f"util {plan.utilization}%"
            ),
            payload={
                "solver": plan.solver,
                "optimal": plan.optimal,
                "selected": [i.feature.name for i in plan.selected],
                "deferred_count": len(plan.deferred),
                "cycles": plan.diagnostics.cycles,
            },
        )
    )
    state.setdefault("completed", set()).add("planner")
    return state


def _node_summary(state: _State) -> _State:
    # Final node: compress the plan into a short explanation suitable for a
    # demo or a management-facing update.
    plan = state.get("sprint_plan")
    if plan is None:
        state["summary"] = "No sprint plan was produced."
    else:
        sel = ", ".join(i.feature.name for i in plan.selected[:8]) or "(none)"
        diag = plan.diagnostics
        cycle_note = (
            f" Dependency cycles detected and auto-broken: {len(diag.cycles)}."
            if diag.cycles
            else ""
        )
        missing_note = (
            f" {len(diag.missing_dependencies)} dangling dependency reference(s) ignored."
            if diag.missing_dependencies
            else ""
        )
        state["summary"] = (
            f"Goal: {state.get('goal', '')}.\n"
            f"Selected {len(plan.selected)} of {len(plan.selected) + len(plan.deferred)} "
            f"features for a velocity of {plan.velocity} "
            f"(utilization {plan.utilization}%, total value {plan.total_value:.1f}) "
            f"using {plan.solver.upper()} on {state.get('algorithm', 'rice').upper()} scores.\n"
            f"Top picks: {sel}.{cycle_note}{missing_note}"
        )
    state.setdefault("trace", []).append(
        SupervisorStep(node="summary", note="brief composed")
    )
    state.setdefault("completed", set()).add("summary")
    return state


# ── Graph factory ────────────────────────────────────────────────────────────

def _build_graph():
    g = StateGraph(_State)
    g.add_node("supervisor", _node_supervisor)
    g.add_node("grooming", _node_grooming)
    g.add_node("prioritization", _node_prioritization)
    g.add_node("planner", _node_planner)
    g.add_node("summary", _node_summary)

    g.set_entry_point("supervisor")
    g.add_conditional_edges(
        "supervisor",
        _route_after_supervisor,
        {
            "grooming": "grooming",
            "prioritization": "prioritization",
            "planner": "planner",
            "summary": "summary",
            "done": END,
        },
    )
    # Every worker returns control to the supervisor so it can decide what's next
    for worker in ("grooming", "prioritization", "planner", "summary"):
        g.add_edge(worker, "supervisor")
    return g.compile()


_GRAPH = None


def run_supervisor(req: SupervisorRequest) -> SupervisorResponse:
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = _build_graph()
    final: _State = _GRAPH.invoke(
        {
            "goal": req.goal,
            "epic": req.epic,
            "velocity": req.velocity,
            "algorithm": req.algorithm,
            "use_ai_blend": req.use_ai_blend,
            "respect_dependencies": req.respect_dependencies,
            "persist_groomed_stories": req.persist_groomed_stories,
            "use_llm_router": req.use_llm_router,
            "features": [],
            "groomed_count": 0,
            "sprint_plan": None,
            "summary": "",
            "completed": set(),
            "iterations": 0,
            "trace": [],
        }
    )
    return SupervisorResponse(
        goal=req.goal,
        summary=final.get("summary", ""),
        sprint_plan=final.get("sprint_plan"),
        groomed_story_count=final.get("groomed_count", 0),
        trace=final.get("trace", []),
        iterations=final.get("iterations", 0),
    )
