"""
PO.ai — Advanced Prioritization Engine v2
==========================================
Algorithms:
  1. RICE v2       — logarithmic effort weighting + confidence² + demand signal
  2. WSJF v2       — time-decay CoD curve + dependency multiplier
  3. ICE           — Impact × Confidence² × Ease
  4. Kano          — Must-be / Performance / Delighter composite
  5. Value/Effort  — quadrant scoring with dynamic thresholds
  6. AI Blend v2   — GPT-4o + Mistral ensemble with chain-of-thought
  7. ML Hybrid     — GradientBoosting ensemble of all algorithm scores

All final scores normalized to 0–100.
"""

from __future__ import annotations

import json
import math
import os
import uuid
import pathlib
from typing import Literal

import numpy as np
from pydantic import BaseModel, Field
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import Pipeline


# ═══════════════════════════════════════════════════════════════════════════════
# DATA MODELS
# ═══════════════════════════════════════════════════════════════════════════════

KanoCategory = Literal["must_be", "performance", "delighter", "indifferent"]
AlgoName = Literal["rice", "wsjf", "ice", "kano", "value_effort", "ai_blend", "ml_hybrid"]


class Feature(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    context: str = ""
    epic: str = ""
    tags: list[str] = []

    # RICE
    reach: float = Field(default=5.0, ge=0, le=10)
    impact: float = Field(default=5.0, ge=0, le=10)
    confidence: float = Field(default=0.8, ge=0.1, le=1.0)
    effort: float = Field(default=5.0, ge=0.5, le=20.0)

    # WSJF
    business_value: float = Field(default=5.0, ge=0, le=10)
    time_criticality: float = Field(default=5.0, ge=0, le=10)
    risk_reduction: float = Field(default=5.0, ge=0, le=10)
    job_size: float = Field(default=5.0, ge=0.5, le=10)

    # ICE
    ease: float = Field(default=5.0, ge=0, le=10)

    # Kano
    kano_category: KanoCategory = "performance"
    satisfaction_gain: float = Field(default=5.0, ge=0, le=10)
    dissatisfaction_risk: float = Field(default=5.0, ge=0, le=10)

    # MoSCoW
    moscow: Literal["must", "should", "could", "wont"] = "should"

    # Strategic context
    strategic_alignment: float = Field(default=5.0, ge=0, le=10)
    dependency_count: int = Field(default=0, ge=0)
    user_requests: int = Field(default=0, ge=0)

    # Dependency graph: ids of features that MUST be selected before this one.
    # Used by the dependency-aware sprint planner (ILP / topological heuristic).
    depends_on: list[str] = Field(default_factory=list)

    # External tracker linkage (e.g. GitHub issue id, Jira key) — used by
    # the integrations layer to keep imports idempotent.
    external_source: str = Field(default="", description="e.g. 'github', 'jira', ''")
    external_id: str = Field(default="", description="External issue id / key, empty if local-only")
    external_url: str = Field(default="", description="Direct link back to the source issue")


class ScoredFeature(BaseModel):
    feature: Feature
    rice_score: float = 0.0
    wsjf_score: float = 0.0
    ice_score: float = 0.0
    kano_score: float = 0.0
    value_effort_score: float = 0.0
    ai_blend_score: float = 0.0
    ml_hybrid_score: float = 0.0
    final_score: float = 0.0
    final_rank: int = 0
    quadrant: str = ""
    explanation: str = ""


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return round(max(lo, min(value, hi)), 2)


# Backwards-compat alias
def clamp_score(value: float) -> float:
    return clamp(value)


# ═══════════════════════════════════════════════════════════════════════════════
# 1. RICE v2
# ═══════════════════════════════════════════════════════════════════════════════

def _beta_confidence_weight(confidence: float) -> float:
    """
    Beta distribution credible interval shrinkage.
    Returns the lower bound of the 80% credible interval — conservative estimate.
      confidence=0.5  → weight ≈ 0.34
      confidence=0.8  → weight ≈ 0.65
      confidence=0.95 → weight ≈ 0.86
    """
    alpha = confidence * 10
    beta  = (1.0 - confidence) * 10 + 1e-6
    mu    = alpha / (alpha + beta)
    sigma = math.sqrt(mu * (1 - mu) / (alpha + beta + 1))
    return max(mu - 1.28 * sigma, 0.01)


def _bayesian_demand_factor(user_requests: int, reach: float) -> float:
    """Log-smoothed demand signal × reach coherence. Returns multiplier in [1.0, 1.25]."""
    if user_requests == 0:
        return 1.0
    log_demand = math.log1p(user_requests) / math.log1p(1000)
    reach_coherence = 0.5 + 0.5 * (reach / 10)
    return 1.0 + 0.25 * log_demand * reach_coherence


def score_rice(f: Feature) -> float:
    """
    RICE v2: (reach × impact × β_weight(confidence)) / log₂(effort+1)
    × bayesian_demand × strategic_mult. Normalized to 0–100.
    """
    # The goal is not to reproduce the raw RICE formula literally, but to
    # turn it into a more stable ranking signal for Product Owner decisions.
    beta_w      = _beta_confidence_weight(f.confidence)
    log_effort  = math.log2(f.effort + 1)
    raw         = (f.reach * f.impact * beta_w) / max(log_effort, 0.1)
    demand_mult    = _bayesian_demand_factor(f.user_requests, f.reach)
    strategic_mult = 0.75 + (f.strategic_alignment / 10) * 0.50
    final = raw * demand_mult * strategic_mult
    return clamp((final / 150) * 100)


# ═══════════════════════════════════════════════════════════════════════════════
# 2. WSJF v2
# ═══════════════════════════════════════════════════════════════════════════════

def _sigmoid_urgency(tc: float) -> float:
    """Sigmoid S-curve for time criticality. tc=0→0, tc=5→≈5, tc=10→≈10."""
    k   = 0.8
    raw = 1 / (1 + math.exp(-k * (tc - 5)))
    lo  = 1 / (1 + math.exp(-k * (0  - 5)))
    hi  = 1 / (1 + math.exp(-k * (10 - 5)))
    return ((raw - lo) / (hi - lo)) * 10


def _weekly_delay_cost(tc: float, business_value: float) -> float:
    """Additive CoD component based on BV × urgency. Returns [0, 3.0]."""
    urgency_weight = _sigmoid_urgency(tc) / 10
    return business_value * urgency_weight * 0.3


def score_wsjf(f: Feature) -> float:
    """
    WSJF v2: SAFe-accurate with sigmoid urgency, delay cost, and √job_size.
    Theoretical max ≈ 51. Normalized to 0–100.
    """
    sa_weight   = 0.70 + 0.30 * (f.strategic_alignment / 10)
    weighted_bv = f.business_value * sa_weight
    sig_tc      = _sigmoid_urgency(f.time_criticality)
    delay_cost  = _weekly_delay_cost(f.time_criticality, f.business_value)
    dep_mult    = 1.0 + min(f.dependency_count * 0.05, 0.30)
    weighted_rr = f.risk_reduction * dep_mult
    cost_of_delay = weighted_bv + sig_tc + delay_cost + weighted_rr
    sqrt_job      = math.sqrt(max(f.job_size, 0.5))
    raw           = cost_of_delay / sqrt_job
    return clamp((raw / 51) * 100)


# ═══════════════════════════════════════════════════════════════════════════════
# 3. ICE
# ═══════════════════════════════════════════════════════════════════════════════

def score_ice(f: Feature) -> float:
    """Impact × Confidence² × Ease. Max = 10 × 1 × 10 = 100."""
    return clamp(f.impact * (f.confidence ** 2) * f.ease)


# ═══════════════════════════════════════════════════════════════════════════════
# 4. Kano Model
# ═══════════════════════════════════════════════════════════════════════════════

KANO_BASE = {"must_be": 85.0, "performance": 50.0, "delighter": 30.0, "indifferent": 5.0}
KANO_WEIGHTS = {
    "must_be":     (0.10, 0.90),
    "performance": (0.55, 0.45),
    "delighter":   (0.80, 0.20),
    "indifferent": (0.10, 0.10),
}


def score_kano(f: Feature) -> float:
    base         = KANO_BASE[f.kano_category]
    sat_w, dis_w = KANO_WEIGHTS[f.kano_category]
    adjustment   = (sat_w * f.satisfaction_gain + dis_w * f.dissatisfaction_risk) * 2.0
    return clamp(base + adjustment - 10)


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Value vs Effort Matrix
# ═══════════════════════════════════════════════════════════════════════════════

def score_value_effort(f: Feature) -> tuple[float, str]:
    """
    Quadrant scoring:
        High Value / Low Effort  → Quick Win  🚀  [85–100]
        High Value / High Effort → Strategic  🏔  [60–84]
        Low Value  / Low Effort  → Fill-in    🌿  [25–59]
        Low Value  / High Effort → Time Sink  ⚠️  [0–24]
    """
    value = (f.business_value * 0.40 + f.impact * 0.35 + f.strategic_alignment * 0.25)
    composite_effort = (f.effort / 2 + f.job_size) / 2
    high_value = value > 5.5
    low_effort = composite_effort < 5.0
    if high_value and low_effort:
        score    = 85 + (value - 5.5) * 3.5 - composite_effort * 0.5
        quadrant = "Quick Win 🚀"
    elif high_value:
        score    = 60 + (value - 5.5) * 5 - (composite_effort - 5) * 1.5
        quadrant = "Strategic 🏔"
    elif low_effort:
        score    = 25 + value * 3 - composite_effort * 0.5
        quadrant = "Fill-in 🌿"
    else:
        score    = max(0, value * 2 - composite_effort * 1.5)
        quadrant = "Time Sink ⚠️"
    return clamp(score), quadrant


# ═══════════════════════════════════════════════════════════════════════════════
# MoSCoW compatibility helper
# ═══════════════════════════════════════════════════════════════════════════════

def score_moscow(f: Feature) -> float:
    """MoSCoW categorical priority. Must=100, Should=75, Could=50, Won't=0."""
    return {"must": 100.0, "should": 75.0, "could": 50.0, "wont": 0.0}.get(f.moscow, 0.0)


# ═══════════════════════════════════════════════════════════════════════════════
# 6. AI Blend v2 — Calibrated few-shot ensemble with confidence weighting
# ═══════════════════════════════════════════════════════════════════════════════

_OPENAI_KEY  = os.getenv("OPENAI_API_KEY")
_MISTRAL_KEY = os.getenv("MISTRAL_API_KEY")

_FEW_SHOT_EXAMPLES = """
=== CALIBRATION EXAMPLES — anchor your scores to these ===

Example 1 → score: 94
  name: "Critical auth bug — users locked out"
  rice: 88, wsjf: 91, moscow: "must", kano: "must_be"
  Reasoning: Security regression blocking real users. Very high CoD, must ship this sprint.

Example 2 → score: 71
  name: "AI-powered sprint planner"
  rice: 74, wsjf: 68, moscow: "should", kano: "delighter"
  Reasoning: High strategic value, decent demand. Not urgent but next-sprint candidate.

Example 3 → score: 48
  name: "Custom PDF report export"
  rice: 45, wsjf: 50, moscow: "could", kano: "performance"
  Reasoning: Nice-to-have, low urgency. Backlog candidate, not sprint-critical.

Example 4 → score: 19
  name: "IPv6 support for internal API"
  rice: 18, wsjf: 22, moscow: "wont", kano: "indifferent"
  Reasoning: Explicitly out of scope, near-zero demand. Deprioritize indefinitely.

=== END CALIBRATION EXAMPLES ===
"""

_SYSTEM_PROMPT = """You are a senior Product Owner evaluating sprint features.
Be accurate, calibrated, and differentiated — never cluster all features at the same score.

RULES:
1. Read ALL features first, then score them relative to each other
2. Use the calibration examples to anchor your scale
3. Step-by-step for each: demand → strategic value → urgency → effort → dependencies
4. must-have + high urgency + many requests → 85–95
5. could-have + no urgency + few requests → 20–45
6. Strategic alignment is a multiplier, not a base score
7. Return a 'confidence' field (0–1) reflecting how certain you are

STRICT JSON ARRAY OUTPUT (no markdown, no preamble):
[{"id":"...","score":<int 0-100>,"confidence":<float 0-1>,"reasoning":"<2-3 sentences>","risk":"<concern or null>"}]
"""


def _parse_ai_response(content: str) -> list[dict]:
    cleaned = content.strip()
    if "```" in cleaned:
        parts   = cleaned.split("```")
        cleaned = parts[1] if len(parts) > 1 else parts[0]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    return json.loads(cleaned.strip())


def _call_mistral(features_json: str) -> list[dict]:
    from langchain_mistralai import ChatMistralAI
    llm  = ChatMistralAI(model="mistral-large-latest", temperature=0.05, api_key=_MISTRAL_KEY)
    resp = llm.invoke(_SYSTEM_PROMPT + _FEW_SHOT_EXAMPLES + "\n\nFeatures:\n" + features_json)
    return _parse_ai_response(resp.content)


def _call_gpt4o(features_json: str) -> list[dict]:
    from langchain_openai import ChatOpenAI
    from langchain.schema import SystemMessage, HumanMessage
    llm  = ChatOpenAI(model="gpt-4o", temperature=0.05, api_key=_OPENAI_KEY)
    resp = llm.invoke([
        SystemMessage(content=_SYSTEM_PROMPT + _FEW_SHOT_EXAMPLES),
        HumanMessage(content=f"Features:\n{features_json}"),
    ])
    return _parse_ai_response(resp.content)


def score_ai_blend(features: list[Feature]) -> dict[str, dict]:
    """
    AI Blend v2 — Calibrated dual-model ensemble (GPT-4o + Mistral).
    Confidence-weighted averaging. Fallback: weighted avg(RICE×0.45, WSJF×0.55).
    """
    # The LLMs score the full backlog independently, then we blend their
    # outputs. This keeps the result explainable and lets each model keep its
    # own calibration.
    features_data = [
        {
            "id":                  f.id,
            "name":                f.name,
            "description":         f.description[:300],
            "epic":                f.epic,
            "tags":                f.tags,
            "moscow":              f.moscow,
            "kano":                f.kano_category,
            "rice_score":          score_rice(f),
            "wsjf_score":          score_wsjf(f),
            "ice_score":           score_ice(f),
            "strategic_alignment": f.strategic_alignment,
            "dependency_count":    f.dependency_count,
            "user_requests":       f.user_requests,
        }
        for f in features
    ]
    features_json = json.dumps(features_data, indent=2, ensure_ascii=False)

    mistral_results: dict[str, dict] = {}
    gpt_results:     dict[str, dict] = {}

    if _MISTRAL_KEY:
        try:
            for r in _call_mistral(features_json):
                mistral_results[r["id"]] = r
        except Exception:
            pass

    if _OPENAI_KEY:
        try:
            for r in _call_gpt4o(features_json):
                gpt_results[r["id"]] = r
        except Exception:
            pass

    output: dict[str, dict] = {}
    for f in features:
        m = mistral_results.get(f.id)
        g = gpt_results.get(f.id)
        if m and g:
            mc    = float(m.get("confidence", 0.8))
            gc    = float(g.get("confidence", 0.8))
            score = (float(m["score"]) * mc + float(g["score"]) * gc) / (mc + gc)
            explanation = (
                f"[GPT-4o conf={gc:.2f}] {g.get('reasoning', '')} | "
                f"[Mistral conf={mc:.2f}] {m.get('reasoning', '')}"
            )
            risk = g.get("risk") or m.get("risk") or ""
        elif m:
            score       = float(m["score"])
            explanation = f"[Mistral] {m.get('reasoning', '')}"
            risk        = m.get("risk", "")
        elif g:
            score       = float(g["score"])
            explanation = f"[GPT-4o] {g.get('reasoning', '')}"
            risk        = g.get("risk", "")
        else:
            score       = score_rice(f) * 0.45 + score_wsjf(f) * 0.55
            explanation = "Fallback: APIs unavailable — weighted avg(RICE×0.45, WSJF×0.55)."
            risk        = ""
        if risk:
            explanation += f" ⚠️ Risk: {risk}"
        output[f.id] = {"score": clamp(score), "explanation": explanation}
    return output


# ═══════════════════════════════════════════════════════════════════════════════
# 7. ML Hybrid — Auto-bootstrapped GradientBoosting
# ═══════════════════════════════════════════════════════════════════════════════

def _generate_bootstrap_data(n: int = 500, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    """
    Generate training data from the mathematical relationships of the other algorithms.
    Label formula: 0.30×rice + 0.30×wsjf + 0.15×ice + 0.15×kano + 0.10×ve + moscow_bonus + dep_bonus
    """
    # This is intentionally synthetic: it creates a controlled training set
    # when no real historical backlog annotations are available yet.
    rng = np.random.default_rng(seed)
    rows_X, rows_y = [], []
    moscow_map = {0: "must", 1: "should", 2: "could", 3: "wont"}
    kano_map   = {0: "must_be", 1: "performance", 2: "delighter", 3: "indifferent"}
    for _ in range(n):
        reach      = rng.uniform(0, 10)
        impact     = rng.uniform(0, 10)
        confidence = rng.uniform(0.1, 1.0)
        effort     = rng.uniform(0.5, 20.0)
        bv         = rng.uniform(0, 10)
        tc         = rng.uniform(0, 10)
        rr         = rng.uniform(0, 10)
        job_size   = rng.uniform(0.5, 10)
        ease       = rng.uniform(0, 10)
        sat_gain   = rng.uniform(0, 10)
        dis_risk   = rng.uniform(0, 10)
        strat      = rng.uniform(0, 10)
        deps       = int(rng.integers(0, 8))
        requests   = int(rng.integers(0, 300))
        moscow_idx = int(rng.integers(0, 4))
        kano_idx   = int(rng.integers(0, 4))
        f = Feature(
            id="boot", name="bootstrap",
            reach=reach, impact=impact, confidence=confidence, effort=effort,
            business_value=bv, time_criticality=tc, risk_reduction=rr, job_size=job_size,
            ease=ease, satisfaction_gain=sat_gain, dissatisfaction_risk=dis_risk,
            strategic_alignment=strat, dependency_count=deps, user_requests=requests,
            moscow=moscow_map[moscow_idx], kano_category=kano_map[kano_idx],
        )
        rice  = score_rice(f)
        wsjf  = score_wsjf(f)
        ice   = score_ice(f)
        kano  = score_kano(f)
        ve, _ = score_value_effort(f)
        moscow_bonus = {"must": 8, "should": 3, "could": 0, "wont": -5}[f.moscow]
        dep_bonus    = min(deps * 1.5, 10)
        label = (
            0.30 * rice + 0.30 * wsjf + 0.15 * ice + 0.15 * kano + 0.10 * ve
            + moscow_bonus + dep_bonus
        )
        label = float(np.clip(label, 0, 100))
        moscow_num = {"must": 4, "should": 3, "could": 2, "wont": 1}[f.moscow]
        rows_X.append([rice, wsjf, ice, kano, ve, moscow_num, strat, deps])
        rows_y.append(label)
    return np.array(rows_X), np.array(rows_y)


_X_BOOT, _Y_BOOT = _generate_bootstrap_data(n=600, seed=42)

_ml_pipeline = Pipeline([
    ("scaler", MinMaxScaler()),
    ("gbr", GradientBoostingRegressor(
        n_estimators=400,
        max_depth=5,
        learning_rate=0.03,
        subsample=0.80,
        min_samples_leaf=3,
        max_features=0.85,
        random_state=42,
    )),
])
_ml_pipeline.fit(_X_BOOT, _Y_BOOT)

try:
    _cv_scores  = cross_val_score(_ml_pipeline, _X_BOOT, _Y_BOOT, cv=5, scoring="r2")
    ML_CV_R2: float = float(np.mean(_cv_scores))
except Exception:
    ML_CV_R2 = 0.0

_gbr_step = _ml_pipeline.named_steps["gbr"]
ML_FEATURE_IMPORTANCE: dict[str, float] = {
    name: round(float(imp), 4)
    for name, imp in zip(
        ["rice", "wsjf", "ice", "kano", "value_effort", "moscow", "strategic", "deps"],
        _gbr_step.feature_importances_,
    )
}


def score_ml_hybrid(
    f: Feature,
    rice: float,
    wsjf: float,
    ice: float,
    kano: float,
    ve: float,
) -> float:
    """GradientBoosting ensemble trained on 600 bootstrapped samples (5-fold CV R²=ML_CV_R2)."""
    moscow_num = {"must": 4, "should": 3, "could": 2, "wont": 1}[f.moscow]
    X = np.array([[rice, wsjf, ice, kano, ve, moscow_num, f.strategic_alignment, f.dependency_count]])
    return clamp(float(_ml_pipeline.predict(X)[0]))


# ═══════════════════════════════════════════════════════════════════════════════
# MASTER SCORING FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

def prioritize(
    features: list[Feature],
    algorithm: AlgoName = "rice",
    use_ai_blend: bool = False,
) -> list[ScoredFeature]:
    # We always compute the full score set so the UI can compare algorithms
    # instantly without recomputing from scratch on each tab change.
    if not features:
        return []

    ai_scores: dict[str, dict] = {}
    if use_ai_blend or algorithm == "ai_blend":
        ai_scores = score_ai_blend(features)

    scored: list[ScoredFeature] = []
    for f in features:
        rice        = score_rice(f)
        wsjf        = score_wsjf(f)
        ice         = score_ice(f)
        kano        = score_kano(f)
        ve, quadrant = score_value_effort(f)
        ai          = ai_scores.get(f.id, {}).get("score", 0.0)
        explanation = ai_scores.get(f.id, {}).get("explanation", "")
        ml          = score_ml_hybrid(f, rice, wsjf, ice, kano, ve)

        scored.append(ScoredFeature(
            feature=f,
            rice_score=rice,
            wsjf_score=wsjf,
            ice_score=ice,
            kano_score=kano,
            value_effort_score=ve,
            ai_blend_score=ai,
            ml_hybrid_score=ml,
            final_score=0.0,
            final_rank=0,
            quadrant=quadrant,
            explanation=explanation,
        ))

    sort_key = {
        "rice":         lambda s: s.rice_score,
        "wsjf":         lambda s: s.wsjf_score,
        "ice":          lambda s: s.ice_score,
        "kano":         lambda s: s.kano_score,
        "value_effort": lambda s: s.value_effort_score,
        "ai_blend":     lambda s: s.ai_blend_score,
        "ml_hybrid":    lambda s: s.ml_hybrid_score,
    }[algorithm]

    scored.sort(key=sort_key, reverse=True)
    for i, s in enumerate(scored):
        s.final_score = sort_key(s)
        s.final_rank  = i + 1

    return scored


# ═══════════════════════════════════════════════════════════════════════════════
# BACKLOG PERSISTENCE
# ═══════════════════════════════════════════════════════════════════════════════

_BACKLOG_PATH = pathlib.Path(__file__).resolve().parent.parent.parent / "data" / "backlog.json"


def _ensure_backlog() -> None:
    _BACKLOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not _BACKLOG_PATH.exists():
        _BACKLOG_PATH.write_text(json.dumps({"features": []}, ensure_ascii=False, indent=2))


def load_backlog() -> list[Feature]:
    _ensure_backlog()
    data = json.loads(_BACKLOG_PATH.read_text())
    return [Feature(**f) for f in data.get("features", [])]


def save_backlog(features: list[Feature]) -> None:
    _ensure_backlog()
    _BACKLOG_PATH.write_text(
        json.dumps({"features": [f.model_dump() for f in features]}, ensure_ascii=False, indent=2)
    )


def add_to_backlog(feature: Feature) -> list[Feature]:
    features = load_backlog()
    features.append(feature)
    save_backlog(features)
    return features


def delete_from_backlog(feature_id: str) -> list[Feature]:
    features = [f for f in load_backlog() if f.id != feature_id]
    save_backlog(features)
    return features

