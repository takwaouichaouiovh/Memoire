"""
Sessions API — /api/sessions
Persists chat conversations in a JSON file so users can retrieve past sessions.

Storage format (data/sessions.json):
[
  {
    "id": "session-abc",
    "title": "Untitled",
    "mode": "chat" | "agent",
    "created_at": "2026-05-25T12:00:00Z",
    "updated_at": "2026-05-25T12:05:00Z",
    "messages": [
      {
        "id": "...",
        "role": "user" | "assistant",
        "content": "...",
        "model": "gpt-4o",
        "sources": [...],
        "tool_calls": [...]
      }
    ]
  }
]
"""

from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import AuthUser, get_current_user

router = APIRouter()

_STORE_PATH = Path("./data/sessions.json")
_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
_LOCK = threading.Lock()


# ── Pydantic models ────────────────────────────────────────────────────────

class StoredMessage(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    model: str | None = None
    sources: list[dict] | None = None
    tool_calls: list[dict] | None = None


class Session(BaseModel):
    id: str
    title: str = "Untitled"
    mode: Literal["chat", "agent"] = "chat"
    created_at: str
    updated_at: str
    messages: list[StoredMessage] = Field(default_factory=list)


class SessionSummary(BaseModel):
    id: str
    title: str
    mode: Literal["chat", "agent"]
    created_at: str
    updated_at: str
    message_count: int


class SessionListResponse(BaseModel):
    sessions: list[SessionSummary]


class RenameRequest(BaseModel):
    title: str


# ── Storage helpers ────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_all() -> list[dict]:
    if not _STORE_PATH.exists():
        return []
    try:
        with _STORE_PATH.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError):
        return []


def _write_all(sessions: list[dict]) -> None:
    with _STORE_PATH.open("w", encoding="utf-8") as fh:
        json.dump(sessions, fh, ensure_ascii=False, indent=2)


def _find(sessions: list[dict], session_id: str) -> dict | None:
    return next((s for s in sessions if s["id"] == session_id), None)


# ── Public helpers (used by chat.py and agents/assistant.py) ──────────────

def append_message(
    session_id: str,
    role: str,
    content: str,
    *,
    mode: str = "chat",
    model: str | None = None,
    sources: list[dict] | None = None,
    tool_calls: list[dict] | None = None,
) -> None:
    """Append a message to a session, creating the session if needed.

    The first user message is used as the default session title.
    """
    with _LOCK:
        sessions = _read_all()
        session = _find(sessions, session_id)
        if session is None:
            session = {
                "id": session_id,
                "title": "Untitled",
                "mode": mode,
                "created_at": _now(),
                "updated_at": _now(),
                "messages": [],
            }
            sessions.append(session)

        # Auto-title from first user message
        if session["title"] == "Untitled" and role == "user":
            session["title"] = (content[:60] + "…") if len(content) > 60 else content

        # Keep mode in sync (an agent message switches the session to agent mode)
        if mode == "agent":
            session["mode"] = "agent"

        msg: dict = {
            "id": f"{role}-{int(datetime.now().timestamp() * 1000)}",
            "role": role,
            "content": content,
        }
        if model:
            msg["model"] = model
        if sources:
            msg["sources"] = sources
        if tool_calls:
            msg["tool_calls"] = tool_calls

        session["messages"].append(msg)
        session["updated_at"] = _now()
        _write_all(sessions)


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.get("/", response_model=SessionListResponse)
async def list_sessions(
    _user: Annotated[AuthUser, Depends(get_current_user)],
) -> SessionListResponse:
    sessions = _read_all()
    summaries = [
        SessionSummary(
            id=s["id"],
            title=s.get("title", "Untitled"),
            mode=s.get("mode", "chat"),
            created_at=s["created_at"],
            updated_at=s["updated_at"],
            message_count=len(s.get("messages", [])),
        )
        for s in sorted(sessions, key=lambda x: x["updated_at"], reverse=True)
    ]
    return SessionListResponse(sessions=summaries)


@router.get("/{session_id}", response_model=Session)
async def get_session(
    session_id: str,
    _user: Annotated[AuthUser, Depends(get_current_user)],
) -> Session:
    sessions = _read_all()
    session = _find(sessions, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return Session(**session)


@router.patch("/{session_id}", response_model=SessionSummary)
async def rename_session(
    session_id: str,
    req: RenameRequest,
    _user: Annotated[AuthUser, Depends(get_current_user)],
) -> SessionSummary:
    with _LOCK:
        sessions = _read_all()
        session = _find(sessions, session_id)
        if session is None:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
        session["title"] = req.title.strip() or "Untitled"
        session["updated_at"] = _now()
        _write_all(sessions)
        return SessionSummary(
            id=session["id"],
            title=session["title"],
            mode=session.get("mode", "chat"),
            created_at=session["created_at"],
            updated_at=session["updated_at"],
            message_count=len(session.get("messages", [])),
        )


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    _user: Annotated[AuthUser, Depends(get_current_user)],
) -> dict:
    with _LOCK:
        sessions = _read_all()
        if _find(sessions, session_id) is None:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
        sessions = [s for s in sessions if s["id"] != session_id]
        _write_all(sessions)
    return {"deleted": session_id}
