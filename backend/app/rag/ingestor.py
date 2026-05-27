"""
Document Ingestion Pipeline
Handles PDF, DOCX, TXT, Markdown uploads → ChromaDB vector store
"""

import os
from pathlib import Path
from langchain_community.document_loaders import (
    PyPDFLoader,
    Docx2txtLoader,
    TextLoader,
)
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma

_CHROMA_PATH = "./data/chroma"
_DOCS_PATH   = "./data/docs"
_OPENAI_KEY  = os.getenv("OPENAI_API_KEY")

SPLITTER = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=120,
    separators=["\n\n", "\n", ".", " "],
)

LOADER_MAP = {
    ".pdf":  PyPDFLoader,
    ".docx": Docx2txtLoader,
    ".txt":  TextLoader,
    ".md":   TextLoader,
}


def load_document(file_path: str):
    ext = Path(file_path).suffix.lower()
    loader_cls = LOADER_MAP.get(ext)
    if not loader_cls:
        raise ValueError(f"Unsupported file type: {ext}")
    # TextLoader defaults to the OS encoding (cp1252 on Windows) which breaks
    # on UTF-8 files containing emojis/accents. Force UTF-8 with auto-fallback.
    if loader_cls is TextLoader:
        loader = TextLoader(file_path, encoding="utf-8", autodetect_encoding=True)
    else:
        loader = loader_cls(file_path)
    docs = loader.load()
    # Tag each chunk with source metadata
    for doc in docs:
        doc.metadata["source"] = Path(file_path).name
    return docs


def ingest_file(file_path: str) -> int:
    """Load, split and embed a single file. Returns chunk count."""
    docs   = load_document(file_path)
    chunks = SPLITTER.split_documents(docs)
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small", api_key=_OPENAI_KEY)
    db = Chroma(persist_directory=_CHROMA_PATH, embedding_function=embeddings)
    db.add_documents(chunks)
    return len(chunks)


def ingest_directory(dir_path: str = _DOCS_PATH) -> dict:
    """Batch ingest all supported files in a directory."""
    results = {}
    for file in Path(dir_path).glob("**/*"):
        if file.suffix.lower() in LOADER_MAP:
            try:
                n = ingest_file(str(file))
                results[file.name] = {"status": "ok", "chunks": n}
            except Exception as e:
                results[file.name] = {"status": "error", "error": str(e)}
    return results


def get_indexed_docs() -> list[dict]:
    """Return list of indexed document sources with chunk counts."""
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small", api_key=_OPENAI_KEY)
    db = Chroma(persist_directory=_CHROMA_PATH, embedding_function=embeddings)
    collection = db._collection
    all_metas  = collection.get(include=["metadatas"])["metadatas"]
    counts: dict[str, int] = {}
    for meta in all_metas:
        src = meta.get("source", "unknown")
        counts[src] = counts.get(src, 0) + 1
    return [{"name": k, "chunks": v} for k, v in counts.items()]
