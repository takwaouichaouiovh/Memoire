"""Pytest tests for the sprint planner (knapsack)."""

from __future__ import annotations

import pytest

from app.prioritization.algorithms import Feature
from app.prioritization.sprint_planner import SprintPlanRequest, plan_sprint


def _f(name: str, impact: float, effort: float) -> Feature:
    return Feature(name=name, impact=impact, effort=effort, confidence=0.9, reach=8)


def test_plan_respects_velocity_capacity():
    features = [_f("A", 9, 5), _f("B", 8, 5), _f("C", 6, 5), _f("D", 4, 5)]
    plan = plan_sprint(SprintPlanRequest(features=features, velocity=10, algorithm="rice"))
    assert plan.total_effort <= 10
    assert plan.utilization <= 100.0


def test_plan_picks_high_value_items_first():
    features = [
        _f("Cheap+High", 10, 2),
        _f("Cheap+Low", 1, 2),
        _f("Expensive", 9, 18),
    ]
    plan = plan_sprint(SprintPlanRequest(features=features, velocity=4, algorithm="rice"))
    names = [item.feature.name for item in plan.selected]
    assert "Cheap+High" in names


def test_plan_with_zero_capacity_selects_nothing():
    features = [_f("A", 9, 5)]
    with pytest.raises(Exception):
        # velocity must be > 0 per pydantic validator
        plan_sprint(SprintPlanRequest(features=features, velocity=0, algorithm="rice"))


def test_plan_returns_selected_plus_deferred_equals_input():
    features = [_f("A", 9, 5), _f("B", 8, 5), _f("C", 6, 5)]
    plan = plan_sprint(SprintPlanRequest(features=features, velocity=5, algorithm="rice"))
    assert len(plan.selected) + len(plan.deferred) == len(features)


def test_plan_strategy_is_knapsack_for_small_inputs():
    features = [_f(f"F{i}", 5, 3) for i in range(5)]
    plan = plan_sprint(SprintPlanRequest(features=features, velocity=10, algorithm="rice"))
    assert plan.strategy == "knapsack"
