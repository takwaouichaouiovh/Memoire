"""
Documents API — /api/documents
Upload and index knowledge base documents
"""

import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
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
async def upload_document(file: UploadFile = File(...)):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}. Allowed: {ALLOWED_EXTENSIONS}")

    dest = UPLOAD_DIR / file.filename
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    chunks = ingest_file(str(dest))
    return DocumentUploadResponse(
        filename=file.filename,
        status="indexed",
        chunks=chunks,
        message=f"Successfully indexed {chunks} chunks from {file.filename}",
    )


@router.get("/", response_model=DocumentListResponse)
async def list_documents():
    docs = [DocumentSummary(**doc) for doc in get_indexed_docs()]
    return DocumentListResponse(documents=docs)


@router.delete("/{filename}", response_model=DocumentDeleteResponse)
async def delete_document(filename: str):
    # Remove from disk
    path = UPLOAD_DIR / filename
    if path.exists():
        path.unlink()
    # Note: ChromaDB deletion by metadata filter requires additional logic
    return DocumentDeleteResponse(
        deleted=filename,
        note="Re-index to fully remove from vector store",
    )
