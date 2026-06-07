"""
Documents API — /api/documents
Upload and index knowledge base documents
"""

import shutil
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException

from app.auth import AuthUser, get_current_user, require_role
from app.notifications_store import create_notification
from app.rag.ingestor import ingest_file, get_indexed_docs
from app.models.api import (
    DocumentDeleteResponse,
    DocumentListResponse,
    DocumentSummary,
    DocumentUploadResponse,
)

router = APIRouter()

UPLOAD_DIR = Path("./data/docs")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    user: Annotated[AuthUser, Depends(require_role("admin", "po"))],
    file: UploadFile = File(...),
):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}. Allowed: {ALLOWED_EXTENSIONS}")

    dest = UPLOAD_DIR / file.filename
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    chunks = ingest_file(str(dest))
    create_notification(
        user_id=user.id,
        title="Document indexed",
        message=f"Indexed {chunks} chunks from {file.filename}.",
        kind="success",
    )
    return DocumentUploadResponse(
        filename=file.filename,
        status="indexed",
        chunks=chunks,
        message=f"Successfully indexed {chunks} chunks from {file.filename}",
    )


@router.get("/", response_model=DocumentListResponse)
async def list_documents(_user: Annotated[AuthUser, Depends(get_current_user)]):
    docs = [DocumentSummary(**doc) for doc in get_indexed_docs()]
    return DocumentListResponse(documents=docs)


@router.delete("/{filename}", response_model=DocumentDeleteResponse)
async def delete_document(
    filename: str,
    _user: Annotated[AuthUser, Depends(require_role("admin", "po"))],
):
    # Remove from disk
    path = UPLOAD_DIR / filename
    if path.exists():
        path.unlink()
    # Note: ChromaDB deletion by metadata filter requires additional logic
    return DocumentDeleteResponse(
        deleted=filename,
        note="Re-index to fully remove from vector store",
    )
