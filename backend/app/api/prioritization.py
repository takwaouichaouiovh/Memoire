"""
Prioritization API — /api/prioritization
"""

import json
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel
from app.prioritization.algorithms import (
    Feature, ScoredFeature, prioritize, AlgoName,
    score_rice, score_wsjf, score_ice, score_kano, score_value_effort, score_moscow,
)
from app.prioritization.sprint_planner import SprintPlan, SprintPlanRequest, plan_sprint
from app.models.api import BacklogDeleteResponse, BacklogListResponse, BacklogSummaryResponse, QuickScoreResponse

router = APIRouter()

BACKLOG_PATH = Path(__file__).resolve().parents[2] / "data" / "backlog.json"


def _read_backlog() -> list[Feature]:
    if not BACKLOG_PATH.exists():
        return []
    raw = json.loads(BACKLOG_PATH.read_text(encoding="utf-8"))
    return [Feature.model_validate(item) for item in raw]


def _write_backlog(features: list[Feature]) -> None:
    BACKLOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    BACKLOG_PATH.write_text(
        json.dumps([feature.model_dump() for feature in features], ensure_ascii=True, indent=2),
        encoding="utf-8",
    )


class PrioritizeRequest(BaseModel):
    features: list[Feature]
    algorithm: AlgoName = "rice"
    use_ai_blend: bool = False


class PrioritizeResponse(BaseModel):
    algorithm: str
    results: list[ScoredFeature]
    total: int


class BacklogUpdateRequest(BaseModel):
    features: list[Feature]


@router.post("/", response_model=PrioritizeResponse)
async def run_prioritization(req: PrioritizeRequest):
    results = prioritize(req.features, req.algorithm, req.use_ai_blend)
    return PrioritizeResponse(
        algorithm=req.algorithm,
        results=results,
        total=len(results),
    )


@router.post("/quick-score", response_model=QuickScoreResponse)
async def quick_score(feature: Feature):
    """Score a single feature across all algorithms instantly."""
    ve, quadrant = score_value_effort(feature)
    return QuickScoreResponse(
        id=feature.id,
        name=feature.name,
        rice=score_rice(feature),
        wsjf=score_wsjf(feature),
        ice=score_ice(feature),
        kano=score_kano(feature),
        value_effort=ve,
        quadrant=quadrant,
        moscow=feature.moscow,
        moscow_score=score_moscow(feature),
    )


@router.get("/backlog", response_model=BacklogListResponse)
async def get_backlog():
    features = _read_backlog()
    return BacklogListResponse(
        features=[feature.model_dump() for feature in features],
        total=len(features),
    )


@router.put("/backlog", response_model=BacklogSummaryResponse)
async def replace_backlog(req: BacklogUpdateRequest):
    _write_backlog(req.features)
    return BacklogSummaryResponse(total=len(req.features))


@router.delete("/backlog/{feature_id}", response_model=BacklogDeleteResponse)
async def delete_backlog_feature(feature_id: str):
    features = _read_backlog()
    filtered = [feature for feature in features if feature.id != feature_id]
    _write_backlog(filtered)
    return BacklogDeleteResponse(deleted=feature_id, total=len(filtered))


@router.post("/sprint-plan", response_model=SprintPlan)
async def sprint_plan(req: SprintPlanRequest):
    """Knapsack-based sprint composition: maximize score within velocity budget."""
    return plan_sprint(req)
