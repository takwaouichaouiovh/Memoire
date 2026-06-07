"""
Prioritization API — /api/prioritization
"""

import json
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth import AuthUser, get_current_user, require_role
from app.notifications_store import create_notification
from app.prioritization.algorithms import (
    Feature, ScoredFeature, prioritize, AlgoName,
    score_rice, score_wsjf, score_ice, score_kano, score_value_effort, score_moscow,
)
from app.prioritization.sprint_planner import SprintPlan, SprintPlanRequest, plan_sprint
from app.prioritization.dependency_planner import (
    DependencyPlanRequest,
    DependencySprintPlan,
    plan_sprint_with_dependencies,
)
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
async def run_prioritization(
    req: PrioritizeRequest,
    _user: Annotated[AuthUser, Depends(get_current_user)],
):
    results = prioritize(req.features, req.algorithm, req.use_ai_blend)
    return PrioritizeResponse(
        algorithm=req.algorithm,
        results=results,
        total=len(results),
    )


@router.post("/quick-score", response_model=QuickScoreResponse)
async def quick_score(
    feature: Feature,
    _user: Annotated[AuthUser, Depends(get_current_user)],
):
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
async def get_backlog(_user: Annotated[AuthUser, Depends(get_current_user)]):
    features = _read_backlog()
    return BacklogListResponse(
        features=[feature.model_dump() for feature in features],
        total=len(features),
    )


@router.put("/backlog", response_model=BacklogSummaryResponse)
async def replace_backlog(
    req: BacklogUpdateRequest,
    user: Annotated[AuthUser, Depends(require_role("admin", "po"))],
):
    _write_backlog(req.features)
    create_notification(
        user_id=user.id,
        title="Backlog updated",
        message=f"Saved {len(req.features)} features to the backlog.",
        kind="info",
    )
    return BacklogSummaryResponse(total=len(req.features))


@router.delete("/backlog/{feature_id}", response_model=BacklogDeleteResponse)
async def delete_backlog_feature(
    feature_id: str,
    _user: Annotated[AuthUser, Depends(require_role("admin", "po"))],
):
    features = _read_backlog()
    filtered = [feature for feature in features if feature.id != feature_id]
    _write_backlog(filtered)
    return BacklogDeleteResponse(deleted=feature_id, total=len(filtered))


@router.post("/sprint-plan", response_model=SprintPlan)
async def sprint_plan(
    req: SprintPlanRequest,
    user: Annotated[AuthUser, Depends(get_current_user)],
):
    """Knapsack-based sprint composition: maximize score within velocity budget."""
    plan = plan_sprint(req)
    create_notification(
        user_id=user.id,
        title="Sprint plan ready",
        message=(
            f"{len(plan.selected)} feature(s) selected for velocity "
            f"{req.velocity} using {req.algorithm.upper()}."
        ),
        kind="success",
    )
    return plan


@router.post("/sprint-plan-deps", response_model=DependencySprintPlan)
async def sprint_plan_with_deps(
    req: DependencyPlanRequest,
    user: Annotated[AuthUser, Depends(get_current_user)],
):
    """Precedence-constrained sprint composition (ILP or topological greedy)."""
    plan = plan_sprint_with_dependencies(req)
    create_notification(
        user_id=user.id,
        title="Dependency-aware sprint plan ready",
        message=(
            f"Solver={plan.solver}, optimal={plan.optimal}, "
            f"selected={len(plan.selected)}."
        ),
        kind="success",
    )
    return plan
