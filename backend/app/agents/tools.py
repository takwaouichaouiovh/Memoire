"""
Tools the assistant can call. Each function has a type-hinted signature and
docstring — LangChain's `@tool` decorator converts these into the OpenAI
function-calling schema automatically.
"""

from __future__ import annotations

from typing import Literal

from langchain_core.tools import tool

from app.api.prioritization import _read_backlog, _write_backlog
from app.prioritization.algorithms import AlgoName, Feature, prioritize
from app.rag.engine import get_vectorstore


@tool
def add_feature(
    name: str,
    description: str = "",
    reach: float = 5.0,
    impact: float = 5.0,
    confidence: float = 0.8,
    effort: float = 3.0,
    business_value: float = 5.0,
    time_criticality: float = 5.0,
    risk_reduction: float = 5.0,
    job_size: float = 3.0,
    moscow: Literal["must", "should", "could", "wont"] = "should",
) -> dict:
    """Add a new feature to the persistent backlog. Returns the created feature."""
    feature = Feature(
        name=name,
        description=description,
        reach=reach,
        impact=impact,
        confidence=confidence,
        effort=effort,
        business_value=business_value,
        time_criticality=time_criticality,
        risk_reduction=risk_reduction,
        job_size=job_size,
        moscow=moscow,
    )
    features = _read_backlog()
    features.append(feature)
    _write_backlog(features)
    return {"id": feature.id, "name": feature.name, "moscow": feature.moscow}


@tool
def re_score(
    algorithm: Literal["rice", "wsjf", "ice", "kano", "value_effort", "ai_blend", "ml_hybrid"] = "rice",
    use_ai_blend: bool = False,
) -> list[dict]:
    """Re-score and rank the current backlog using the chosen algorithm.
    Returns the ranked feature list with scores."""
    features = _read_backlog()
    scored = prioritize(features, algorithm, use_ai_blend)
    return [
        {
            "rank": s.final_rank,
            "name": s.feature.name,
            "score": s.final_score,
            "moscow": s.feature.moscow,
        }
        for s in scored
    ]


@tool
def search_docs(query: str, k: int = 4) -> list[dict]:
    """Search the indexed knowledge base (Scrum guides, PO docs, etc.) and
    return the top-k most relevant excerpts."""
    vs = get_vectorstore()
    docs = vs.similarity_search(query, k=k)
    return [
        {
            "source": d.metadata.get("source", "Knowledge Base"),
            "page": d.metadata.get("page"),
            "snippet": d.page_content[:300],
        }
        for d in docs
    ]


ALL_TOOLS = [add_feature, re_score, search_docs]
TOOL_MAP = {t.name: t for t in ALL_TOOLS}
