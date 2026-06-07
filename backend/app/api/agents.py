"""
Agents API — /api/agents
Endpoints: groom-epic (LangGraph), assistant (tool-calling), retro (structured output).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.agents.assistant import AssistantRequest, AssistantResponse, clear_assistant_session, run_assistant
from app.agents.grooming import GroomingRequest, GroomingResponse, groom_epic
from app.agents.retro import RetroRequest, RetroResponse, analyze_retro
from app.agents.supervisor import SupervisorRequest, SupervisorResponse, run_supervisor
from app.auth import AuthUser, get_current_user, require_role
from app.notifications_store import create_notification

router = APIRouter()


@router.post("/supervisor", response_model=SupervisorResponse)
async def api_supervisor(
    req: SupervisorRequest,
    user: Annotated[AuthUser, Depends(require_role("admin", "po"))],
):
    """Multi-agent supervisor: groom → prioritize → plan → summarize."""
    try:
        result = run_supervisor(req)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Supervisor failed: {exc}") from exc

    create_notification(
        user_id=user.id,
        title="Supervisor run complete",
        message=f"Goal: {req.goal[:80]}… — {result.groomed_story_count} stories groomed.",
        kind="success",
    )
    return result


@router.post("/groom-epic", response_model=GroomingResponse)
async def api_groom_epic(
    req: GroomingRequest,
    user: Annotated[AuthUser, Depends(require_role("admin", "po"))],
):
    try:
        result = groom_epic(req)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Grooming failed: {exc}") from exc

    create_notification(
        user_id=user.id,
        title="Epic groomed",
        message=f"Generated {len(result.stories)} INVEST stories.",
        kind="success",
    )
    return result


@router.post("/assistant", response_model=AssistantResponse)
async def api_assistant(
    req: AssistantRequest,
    _user: Annotated[AuthUser, Depends(get_current_user)],
):
    try:
        return run_assistant(req)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Assistant failed: {exc}") from exc


@router.delete("/assistant/session/{session_id}")
async def api_clear_assistant(
    session_id: str,
    _user: Annotated[AuthUser, Depends(get_current_user)],
):
    clear_assistant_session(session_id)
    return {"cleared": session_id}


@router.post("/retro", response_model=RetroResponse)
async def api_retro(
    req: RetroRequest,
    _user: Annotated[AuthUser, Depends(get_current_user)],
):
    try:
        return analyze_retro(req)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Retro analysis failed: {exc}") from exc
