"""
Retrospective Analyzer — paste meeting notes, get structured insights.
Single LLM call with Pydantic structured output. Bilingual (FR/EN).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.agents.llm import get_structured_llm


class ActionItem(BaseModel):
    title: str
    owner: str | None = None
    due: str | None = None


class Risk(BaseModel):
    title: str
    severity: Literal["low", "medium", "high"] = "medium"
    mitigation: str = ""


class RetroRequest(BaseModel):
    notes: str = Field(default="", description="Raw retrospective meeting notes")
    action_items: list[ActionItem] = []
    risks: list[Risk] = []
    wins: list[str] = []
    blockers: list[str] = []

    @model_validator(mode="after")
    def validate_non_empty_input(self) -> "RetroRequest":
        has_notes = len(self.notes.strip()) >= 10
        has_structured = bool(self.action_items or self.risks or self.wins or self.blockers)
        if not has_notes and not has_structured:
            raise ValueError("Provide either notes (>=10 chars) or at least one structured retro item")
        return self


class RetroResponse(BaseModel):
    action_items: list[ActionItem] = []
    risks: list[Risk] = []
    wins: list[str] = []
    blockers: list[str] = []
    summary: str = ""


_SYSTEM = """You are an Agile coach analyzing a sprint retrospective.
From the meeting notes provided, extract:
- action_items: concrete next steps (with owner/due date if mentioned)
- risks: threats to upcoming work, each with severity (low/medium/high) and a mitigation
- wins: things that went well and should continue
- blockers: open impediments still blocking the team
- summary: 1-2 sentence overall recap

Respond in the same language as the notes (French or English).
Be concise and actionable. Do NOT invent owners or dates that are not in the notes."""


def _dedupe_lines(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for v in values:
        normalized = v.strip().lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        out.append(v.strip())
    return out


def analyze_retro(req: RetroRequest) -> RetroResponse:
    notes = req.notes.strip()

    # Structured-only mode: user fills items manually without meeting notes.
    if len(notes) < 10:
        return RetroResponse(
            action_items=req.action_items,
            risks=req.risks,
            wins=_dedupe_lines(req.wins),
            blockers=_dedupe_lines(req.blockers),
            summary="Synthese manuelle de retro fournie par l'utilisateur.",
        )

    llm = get_structured_llm(RetroResponse, model="gpt-4o")
    ai = llm.invoke([
        {"role": "system", "content": _SYSTEM},
        {"role": "user", "content": notes},
    ])

    # Hybrid mode: merge user-provided structured fields with AI extraction.
    merged_actions = ai.action_items + req.action_items
    merged_risks = ai.risks + req.risks

    # Keep risks/actions unique by title while preserving order.
    action_seen: set[str] = set()
    unique_actions: list[ActionItem] = []
    for item in merged_actions:
        key = item.title.strip().lower()
        if not key or key in action_seen:
            continue
        action_seen.add(key)
        unique_actions.append(item)

    risk_seen: set[str] = set()
    unique_risks: list[Risk] = []
    for item in merged_risks:
        key = item.title.strip().lower()
        if not key or key in risk_seen:
            continue
        risk_seen.add(key)
        unique_risks.append(item)

    return RetroResponse(
        action_items=unique_actions,
        risks=unique_risks,
        wins=_dedupe_lines(ai.wins + req.wins),
        blockers=_dedupe_lines(ai.blockers + req.blockers),
        summary=ai.summary,
    )
