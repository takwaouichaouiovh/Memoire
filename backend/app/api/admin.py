"""Admin endpoints — demo helpers (reset state, etc.)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth import AuthUser, require_role
from app.notifications_store import create_notification

router = APIRouter()

_BACKLOG_PATH = Path(__file__).resolve().parents[2] / "data" / "backlog.json"
_SESSIONS_PATH = Path(__file__).resolve().parents[2] / "data" / "sessions.json"


class ResetResponse(BaseModel):
    backlog_cleared: bool
    sessions_cleared: bool


@router.post("/reset-demo", response_model=ResetResponse)
async def reset_demo(
    user: Annotated[AuthUser, Depends(require_role("admin"))],
) -> ResetResponse:
    """Wipe runtime state so the next demo starts clean.

    - Backlog → empty list
    - Sessions store → empty dict
    Vector store and uploaded documents are kept intentionally.
    """
    backlog_cleared = False
    sessions_cleared = False

    if _BACKLOG_PATH.parent.exists():
        _BACKLOG_PATH.write_text("[]", encoding="utf-8")
        backlog_cleared = True

    if _SESSIONS_PATH.parent.exists():
        _SESSIONS_PATH.write_text(json.dumps({}), encoding="utf-8")
        sessions_cleared = True

    create_notification(
        user_id=user.id,
        title="Demo reset",
        message=f"Backlog cleared={backlog_cleared}, sessions cleared={sessions_cleared}.",
        kind="warning",
    )

    return ResetResponse(
        backlog_cleared=backlog_cleared,
        sessions_cleared=sessions_cleared,
    )
