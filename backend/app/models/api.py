from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    version: str


class SourceItem(BaseModel):
    name: str
    page: int | None = None
    snippet: str | None = None


class SessionClearResponse(BaseModel):
    cleared: str


class QuickScoreResponse(BaseModel):
    id: str
    name: str
    rice: float
    wsjf: float
    ice: float
    kano: float
    value_effort: float
    quadrant: str
    moscow: Literal["must", "should", "could", "wont"]
    moscow_score: float


class DocumentSummary(BaseModel):
    name: str
    chunks: int


class DocumentUploadResponse(BaseModel):
    filename: str
    status: str
    chunks: int
    message: str


class DocumentListResponse(BaseModel):
    documents: list[DocumentSummary]


class DocumentDeleteResponse(BaseModel):
    deleted: str
    note: str


class BacklogSummaryResponse(BaseModel):
    total: int


class BacklogListResponse(BaseModel):
    features: list[dict]
    total: int


class BacklogDeleteResponse(BaseModel):
    deleted: str
    total: int
