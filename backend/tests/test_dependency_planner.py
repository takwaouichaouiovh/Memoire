"""Tests for the precedence-constrained sprint planner."""

from __future__ import annotations

import pytest

from app.prioritization.algorithms import Feature
from app.prioritization.dependency_planner import (
    DependencyPlanRequest,
    _build_graph,
    _find_cycles,
    _topological_order,
    plan_sprint_with_dependencies,
)


def _f(fid: str, impact: float, effort: float, depends_on: list[str] | None = None) -> Feature:
    return Feature(
        id=fid,
        name=fid,
        impact=impact,
        effort=effort,
        confidence=0.9,
        reach=8,
        depends_on=depends_on or [],
    )


def test_build_graph_detects_missing_deps():
    features = [_f("A", 8, 3), _f("B", 7, 4, depends_on=["A", "Z"])]
    _adj, diag = _build_graph(features)
    assert "Z" in diag.missing_dependencies
    assert diag.n_edges == 1  # only A->B counted (Z dropped)


def test_find_cycles():
    adj = {"A": ["B"], "B": ["C"], "C": ["A"]}
    cycles = _find_cycles(adj)
    assert any({"A", "B", "C"}.issubset(set(c)) for c in cycles)


def test_topological_order_is_consistent():
    adj = {"A": [], "B": ["A"], "C": ["B"], "D": ["A"]}
    order = _topological_order(adj)
    assert order.index("A") < order.index("B")
    assert order.index("B") < order.index("C")
    assert order.index("A") < order.index("D")


def test_plan_respects_velocity_with_no_deps():
    features = [_f("A", 9, 5), _f("B", 8, 5), _f("C", 6, 5)]
    plan = plan_sprint_with_dependencies(
        DependencyPlanRequest(features=features, velocity=10, algorithm="rice")
    )
    assert plan.total_effort <= 10


def test_dependent_feature_pulls_parent_when_selected():
    """If B depends on A and B is selected, A must also be selected."""
    features = [
        _f("A", 4, 3),               # parent, low score
        _f("B", 10, 4, depends_on=["A"]),  # child, very high score
        _f("C", 3, 5),               # noise
    ]
    plan = plan_sprint_with_dependencies(
        DependencyPlanRequest(features=features, velocity=8, algorithm="rice")
    )
    selected_ids = {item.feature.id for item in plan.selected}
    if "B" in selected_ids:
        assert "A" in selected_ids, "Precedence violated: B picked without A"


def test_orphan_child_never_alone_when_parent_excluded_by_budget():
    """Child with huge effort + dep on huge-effort parent cannot fit alone."""
    features = [
        _f("Parent", 5, 20),
        _f("Child", 10, 1, depends_on=["Parent"]),
    ]
    plan = plan_sprint_with_dependencies(
        DependencyPlanRequest(features=features, velocity=5, algorithm="rice")
    )
    selected_ids = {item.feature.id for item in plan.selected}
    assert "Child" not in selected_ids


def test_cycle_is_broken_not_crashed():
    features = [
        _f("A", 5, 3, depends_on=["B"]),
        _f("B", 5, 3, depends_on=["A"]),
    ]
    plan = plan_sprint_with_dependencies(
        DependencyPlanRequest(features=features, velocity=10, algorithm="rice")
    )
    assert plan.diagnostics.cycles, "expected cycle to be reported"
    # Should still produce a plan (cycle auto-broken)
    assert plan.total_effort <= 10


def test_greedy_solver_path_explicit():
    features = [_f("A", 9, 5), _f("B", 8, 5, depends_on=["A"])]
    plan = plan_sprint_with_dependencies(
        DependencyPlanRequest(
            features=features, velocity=10, algorithm="rice", solver="greedy"
        )
    )
    assert plan.solver == "greedy"


def test_plan_returns_all_features_partitioned():
    features = [_f("A", 9, 5), _f("B", 8, 5), _f("C", 6, 5)]
    plan = plan_sprint_with_dependencies(
        DependencyPlanRequest(features=features, velocity=10, algorithm="rice")
    )
    assert len(plan.selected) + len(plan.deferred) == len(features)
