"""
Sprint Planner — 0/1 knapsack on prioritized features.
Pure algorithm, no LLM. Given a team velocity (in effort units / story points),
pick the subset of features that maximizes total prioritization score while
fitting within velocity.
"""

from __future__ import annotations

import math
from typing import Literal

from pydantic import BaseModel, Field

from app.prioritization.algorithms import (
    AlgoName,
    Feature,
    ScoredFeature,
    prioritize,
)


class SprintPlanRequest(BaseModel):
    features: list[Feature]
    velocity: float = Field(default=20.0, gt=0, description="Total effort capacity for the sprint")
    algorithm: AlgoName = "rice"
    use_ai_blend: bool = False


class SprintPlanItem(BaseModel):
    feature: Feature
    score: float
    effort: float
    rank: int


class SprintPlan(BaseModel):
    algorithm: str
    velocity: float
    selected: list[SprintPlanItem]
    deferred: list[SprintPlanItem]
    total_effort: float
    total_value: float
    utilization: float
    strategy: Literal["knapsack", "greedy_fallback"]


def _knapsack(items: list[tuple[int, float]], capacity: int) -> list[int]:
    """0/1 knapsack DP. items = [(weight, value)]. Returns indices of chosen items."""
    n = len(items)
    if n == 0 or capacity <= 0:
        return []
    dp = [[0.0] * (capacity + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        w, v = items[i - 1]
        for c in range(capacity + 1):
            dp[i][c] = dp[i - 1][c]
            if w <= c:
                take = dp[i - 1][c - w] + v
                if take > dp[i][c]:
                    dp[i][c] = take
    chosen: list[int] = []
    c = capacity
    for i in range(n, 0, -1):
        if dp[i][c] != dp[i - 1][c]:
            chosen.append(i - 1)
            c -= items[i - 1][0]
    chosen.reverse()
    return chosen


def plan_sprint(req: SprintPlanRequest) -> SprintPlan:
    scored: list[ScoredFeature] = prioritize(req.features, req.algorithm, req.use_ai_blend)

    # Scale effort to integers for DP (multiply by 2 → handles .5 increments).
    scale = 2
    capacity = max(int(round(req.velocity * scale)), 0)
    items: list[tuple[int, float]] = [
        (max(int(round(s.feature.effort * scale)), 1), max(s.final_score, 0.0))
        for s in scored
    ]

    strategy: Literal["knapsack", "greedy_fallback"] = "knapsack"
    # Cap DP cost: if n × capacity is huge, fall back to greedy by score/effort ratio.
    if len(items) * (capacity + 1) > 200_000:
        strategy = "greedy_fallback"
        order = sorted(
            range(len(items)),
            key=lambda i: items[i][1] / items[i][0] if items[i][0] else 0,
            reverse=True,
        )
        selected_idx: list[int] = []
        used = 0
        for i in order:
            if used + items[i][0] <= capacity:
                selected_idx.append(i)
                used += items[i][0]
        selected_idx.sort()
    else:
        selected_idx = _knapsack(items, capacity)

    selected_set = set(selected_idx)

    selected: list[SprintPlanItem] = []
    deferred: list[SprintPlanItem] = []
    for idx, s in enumerate(scored):
        item = SprintPlanItem(
            feature=s.feature,
            score=s.final_score,
            effort=s.feature.effort,
            rank=s.final_rank,
        )
        (selected if idx in selected_set else deferred).append(item)

    total_effort = round(sum(i.effort for i in selected), 2)
    total_value = round(sum(i.score for i in selected), 2)
    utilization = round((total_effort / req.velocity) * 100, 1) if req.velocity else 0.0

    return SprintPlan(
        algorithm=req.algorithm,
        velocity=req.velocity,
        selected=selected,
        deferred=deferred,
        total_effort=total_effort,
        total_value=total_value,
        utilization=utilization,
        strategy=strategy,
    )
