"""Pytest tests for prioritization algorithms.

All algorithms must return scores normalized to 0..100.
"""

from __future__ import annotations

import pytest

from app.prioritization.algorithms import (
    Feature,
    prioritize,
    score_ice,
    score_kano,
    score_moscow,
    score_rice,
    score_value_effort,
    score_wsjf,
)


def _feature(**overrides) -> Feature:
    defaults: dict = dict(
        name="Test feature",
        reach=5,
        impact=5,
        confidence=0.8,
        effort=5,
        business_value=5,
        time_criticality=5,
        risk_reduction=5,
        job_size=5,
        ease=5,
        satisfaction_gain=5,
        dissatisfaction_risk=5,
        strategic_alignment=5,
    )
    defaults.update(overrides)
    return Feature(**defaults)


# ── Score range invariants ──────────────────────────────────────────────────


@pytest.mark.parametrize(
    "scorer",
    [score_rice, score_wsjf, score_ice, score_kano],
)
def test_scores_are_within_0_100(scorer):
    f = _feature()
    score = scorer(f)
    assert 0.0 <= score <= 100.0


def test_value_effort_returns_score_and_quadrant():
    score, quadrant = score_value_effort(_feature(impact=9, effort=2))
    assert 0.0 <= score <= 100.0
    assert any(label in quadrant for label in ("Quick Win", "Big Bet", "Fill-in", "Time Sink"))


def test_moscow_score_ordering():
    must = score_moscow(_feature(moscow="must"))
    should = score_moscow(_feature(moscow="should"))
    could = score_moscow(_feature(moscow="could"))
    wont = score_moscow(_feature(moscow="wont"))
    assert must > should > could > wont


# ── RICE behaviour ──────────────────────────────────────────────────────────


def test_rice_high_effort_lowers_score():
    low_effort = score_rice(_feature(effort=1))
    high_effort = score_rice(_feature(effort=20))
    assert low_effort > high_effort


def test_rice_higher_confidence_raises_score():
    low_conf = score_rice(_feature(confidence=0.2))
    high_conf = score_rice(_feature(confidence=1.0))
    assert high_conf > low_conf


# ── WSJF behaviour ──────────────────────────────────────────────────────────


def test_wsjf_bigger_job_lowers_score():
    small_job = score_wsjf(_feature(job_size=1))
    big_job = score_wsjf(_feature(job_size=10))
    assert small_job > big_job


# ── Prioritize end-to-end ───────────────────────────────────────────────────


def test_prioritize_returns_all_features_ranked():
    features = [
        _feature(name="A", impact=9, effort=2),
        _feature(name="B", impact=3, effort=10),
        _feature(name="C", impact=6, effort=5),
    ]
    results = prioritize(features, algorithm="rice")
    assert len(results) == 3
    ranks = sorted(r.final_rank for r in results)
    assert ranks == [1, 2, 3]


def test_prioritize_orders_by_final_score_desc():
    features = [
        _feature(name="A", impact=2, effort=10),
        _feature(name="B", impact=10, effort=1),
    ]
    results = prioritize(features, algorithm="rice")
    by_rank = sorted(results, key=lambda r: r.final_rank)
    assert by_rank[0].feature.name == "B"
    assert by_rank[0].final_score >= by_rank[1].final_score


def test_prioritize_with_empty_list_returns_empty():
    assert prioritize([], algorithm="rice") == []
