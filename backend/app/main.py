"""
PO.ai — Backend API
FastAPI + LangChain + RAG (OpenAI GPT-4o + Mistral)
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load backend/.env before importing API modules that initialize LLM config.
load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env", override=True)

from app.api import chat, prioritization, documents, agents, sessions, admin, integrations
from app.models.api import HealthResponse

app = FastAPI(
    title="PO.ai API",
    description="AI-powered assistant for Product Owners",
    version="1.0.0"
)

# CORS: comma-separated origins via CORS_ORIGINS env var, plus regex for any Vercel preview
# and any localhost port (handy when Next.js falls back to 3001/3002).
_cors_env = os.getenv("CORS_ORIGINS", "http://localhost:3000")
_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.vercel\.app",
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
app.include_router(integrations.router, prefix="/api/integrations", tags=["integrations"])


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", version="1.0.0")
