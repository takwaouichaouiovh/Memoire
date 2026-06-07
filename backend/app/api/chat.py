"""
Chat API — /api/chat
Streaming RAG responses with model routing
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.auth import AuthUser, get_current_user
from app.rag.engine import build_rag_chain, route_model, format_sources
from app.models.api import SourceItem, SessionClearResponse
from app.api.sessions import append_message
import json

router = APIRouter()

# In-memory session store (replace with Redis in production)
_sessions: dict[str, object] = {}


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    model: str | None = None          # None = auto-route


class ChatResponse(BaseModel):
    answer: str
    model_used: str
    sources: list[SourceItem]
    session_id: str


@router.post("/", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    _user: Annotated[AuthUser, Depends(get_current_user)],
):
    model = req.model or route_model(req.message)

    try:
        if req.session_id not in _sessions:
            _sessions[req.session_id] = build_rag_chain(model=model, session_id=req.session_id)

        chain = _sessions[req.session_id]
        result = chain.invoke({"question": req.message})
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Chat generation failed: {exc}") from exc

    sources = format_sources(result.get("source_documents", []))

    # Persist the exchange so the user can retrieve past sessions
    try:
        append_message(req.session_id, "user", req.message, mode="chat")
        append_message(
            req.session_id,
            "assistant",
            result["answer"],
            mode="chat",
            model=model,
            sources=[s.model_dump() if hasattr(s, "model_dump") else dict(s) for s in sources],
        )
    except Exception:
        # Never fail the chat response because of a persistence error
        pass

    return ChatResponse(
        answer=result["answer"],
        model_used=model,
        sources=sources,
        session_id=req.session_id,
    )


@router.post("/stream")
async def chat_stream(
    req: ChatRequest,
    _user: Annotated[AuthUser, Depends(get_current_user)],
):
    """Server-Sent Events streaming endpoint."""
    model = req.model or route_model(req.message)
    chain = build_rag_chain(model=model, session_id=req.session_id)

    async def event_generator():
        result = chain.invoke({"question": req.message})
        words  = result["answer"].split(" ")
        for word in words:
            chunk = json.dumps({"token": word + " ", "done": False})
            yield f"data: {chunk}\n\n"
        sources = format_sources(result.get("source_documents", []))
        yield f"data: {json.dumps({'token': '', 'done': True, 'sources': sources, 'model': model})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.delete("/session/{session_id}", response_model=SessionClearResponse)
async def clear_session(
    session_id: str,
    _user: Annotated[AuthUser, Depends(get_current_user)],
):
    _sessions.pop(session_id, None)
    return SessionClearResponse(cleared=session_id)
