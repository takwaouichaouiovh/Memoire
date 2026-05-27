"""
PO.ai — Backend API
FastAPI + LangChain + RAG (OpenAI GPT-4o + Mistral)
"""

from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load backend/.env before importing API modules that initialize LLM config.
load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env", override=True)

from app.api import chat, prioritization, documents, agents, sessions, admin
from app.models.api import HealthResponse

app = FastAPI(
    title="PO.ai API",
    description="AI-powered assistant for Product Owners",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(prioritization.router, prefix="/api/prioritization", tags=["prioritization"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", version="1.0.0")
