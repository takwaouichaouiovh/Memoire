"""
Agents API — /api/agents
Endpoints: groom-epic (LangGraph), assistant (tool-calling), retro (structured output).
"""

from fastapi import APIRouter, HTTPException

from app.agents.assistant import AssistantRequest, AssistantResponse, clear_assistant_session, run_assistant
from app.agents.grooming import GroomingRequest, GroomingResponse, groom_epic
from app.agents.retro import RetroRequest, RetroResponse, analyze_retro

router = APIRouter()


@router.post("/groom-epic", response_model=GroomingResponse)
async def api_groom_epic(req: GroomingRequest):
    try:
        return groom_epic(req)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Grooming failed: {exc}") from exc


@router.post("/assistant", response_model=AssistantResponse)
async def api_assistant(req: AssistantRequest):
    try:
        return run_assistant(req)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Assistant failed: {exc}") from exc


@router.delete("/assistant/session/{session_id}")
async def api_clear_assistant(session_id: str):
    clear_assistant_session(session_id)
    return {"cleared": session_id}


@router.post("/retro", response_model=RetroResponse)
async def api_retro(req: RetroRequest):
    try:
        return analyze_retro(req)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Retro analysis failed: {exc}") from exc
