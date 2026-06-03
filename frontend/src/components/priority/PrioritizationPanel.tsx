"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, CircleHelp, Info, Plus, RefreshCw, Sparkles, Trash2, TrendingUp, Wand2 } from "lucide-react";

// ── Inline reusable hover/focus tooltip ──────────────────────────────────────
function InfoTooltip({
  content,
  children,
  side = "top",
  className = "",
}: {
  content: ReactNode;
  children?: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const sideClass = {
    top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
    bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
    left: "right-full top-1/2 mr-2 -translate-y-1/2",
    right: "left-full top-1/2 ml-2 -translate-y-1/2",
  }[side];
  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      {children ?? <Info className="h-3.5 w-3.5 cursor-help text-zinc-400 hover:text-violet-300" />}
      {open && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute z-50 w-72 max-w-[280px] whitespace-normal rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-left text-[11px] font-normal leading-relaxed text-zinc-200 shadow-xl ${sideClass}`}
        >
          {content}
        </span>
      )}
    </span>
  );
}

const ALGO_TOOLTIPS: Record<string, ReactNode> = {
  rice: (
    <>
      <b>RICE v2</b> — (Reach × Impact × Confidence) / Effort, with Bayesian
      confidence smoothing and log-scaled effort. Best for evidence-based
      backlog ranking. Normalized to 0–100.
    </>
  ),
  wsjf: (
    <>
      <b>WSJF v2 (SAFe)</b> — Weighted Shortest Job First: (Business Value +
      Time Criticality + Risk Reduction) / Job Size. Maximizes economic
      delivery; favors small high-urgency items.
    </>
  ),
  ice: (
    <>
      <b>ICE</b> — Impact × Confidence² × Ease. A lightweight alternative to
      RICE for quick triage when reach data is not available.
    </>
  ),
  kano: (
    <>
      <b>Kano model</b> — Classifies features as Must-be, Performance, or
      Delighter, weighting satisfaction gain against dissatisfaction risk.
      Great for UX-driven roadmaps.
    </>
  ),
  value_effort: (
    <>
      <b>Value / Effort</b> — 2×2 quadrant: Quick Wins, Strategic Bets,
      Fill-ins, Time Sinks. Surfaces low-effort, high-value items first.
    </>
  ),
  ai_blend: (
    <>
      <b>AI Blend ✦</b> — Ensemble of GPT-4o + Mistral Large. The LLMs
      produce calibrated scores with natural-language rationales, blended
      with classic RICE/WSJF signals.
    </>
  ),
  ml_hybrid: (
    <>
      <b>ML Hybrid</b> — Local GradientBoosting regressor trained on a
      600-sample bootstrap of historical RICE/WSJF scores. Fast,
      deterministic, no API call required.
    </>
  ),
};
import GroomEpicModal from "./GroomEpicModal";
import {
  Algorithm,
  Feature,
  ScoredFeature,
  runPrioritization,
} from "../../hooks/usePrioritization";
import {
  calculateRiceScore,
  calculateWsjfScore,
  calculateIceScore,
  calculateKanoScore,
  calculateValueEffortScore,
} from "../../lib/utils";
import {
  deletePrioritizationFeature,
  fetchPrioritizationBacklog,
  savePrioritizationBacklog,
} from "../../lib/api";

// ── Demo data ─────────────────────────────────────────────────────────────────
// These seeded features make the dashboard useful on first load, even before
// the user imports a real backlog.

const DEMO_FEATURES: Feature[] = [
  { id: "f1", name: "AI sprint auto-planner", description: "As a PO, I want sprint proposals so that planning is faster.", context: "Goal: reduce sprint planning meeting time by 30%.", reach: 8.2, impact: 9, confidence: 0.8, effort: 5, business_value: 9, time_criticality: 8, risk_reduction: 6, job_size: 5, ease: 4, kano_category: "delighter", satisfaction_gain: 9, dissatisfaction_risk: 3, moscow: "must", tags: ["domain:ai", "team:product"], epic: "EPIC-AI-031", strategic_alignment: 9, dependency_count: 2, user_requests: 80 },
  { id: "f2", name: "Stakeholder dashboard", description: "As a stakeholder, I want a real-time dashboard so that I can track delivery.", context: "Target audience: C-level and customer success.", reach: 7.5, impact: 8.1, confidence: 0.9, effort: 6, business_value: 8, time_criticality: 6, risk_reduction: 5, job_size: 6, ease: 6, kano_category: "performance", satisfaction_gain: 8, dissatisfaction_risk: 6, moscow: "should", tags: ["domain:reporting", "team:frontend"], epic: "EPIC-DATA-014", strategic_alignment: 7, dependency_count: 1, user_requests: 45 },
  { id: "f3", name: "Duplicate story detector", description: "As a PO, I want duplicate alerts so that backlog quality improves.", context: "Tenant backlog quality objective for Q3.", reach: 6, impact: 7, confidence: 0.85, effort: 3, business_value: 6, time_criticality: 4, risk_reduction: 7, job_size: 3, ease: 8, kano_category: "performance", satisfaction_gain: 6, dissatisfaction_risk: 4, moscow: "could", tags: ["domain:backlog", "risk:quality"], epic: "EPIC-AI-027", strategic_alignment: 5, dependency_count: 0, user_requests: 20 },
  { id: "f4", name: "Multi-team dependency map", description: "As a PO, I want to visualize dependencies so that release risk is reduced.", context: "Cross-team coordination initiative with 3 squads.", reach: 5.5, impact: 6.5, confidence: 0.7, effort: 8, business_value: 7, time_criticality: 5, risk_reduction: 8, job_size: 8, ease: 3, kano_category: "performance", satisfaction_gain: 7, dissatisfaction_risk: 7, moscow: "should", tags: ["domain:planning", "risk:delivery"], epic: "EPIC-TECH-019", strategic_alignment: 8, dependency_count: 4, user_requests: 30 },
];

const EPIC_PRESETS = [
  "EPIC-AUTH-014",
  "EPIC-AI-027",
  "EPIC-AI-031",
  "EPIC-SEC-021",
  "EPIC-DATA-014",
  "EPIC-INT-012",
  "EPIC-PERF-008",
  "EPIC-TECH-019",
];

const ALGOS: { key: Algorithm; label: string; description: string }[] = [
  { key: "rice", label: "RICE v2", description: "Bayesian confidence + log effort + demand signal" },
  { key: "wsjf", label: "WSJF v2", description: "Sigmoid urgency + weekly delay cost (SAFe)" },
  { key: "ice", label: "ICE", description: "Impact × Confidence² × Ease" },
  { key: "kano", label: "Kano", description: "Must-be / Performance / Delighter composite" },
  { key: "value_effort", label: "Value/Effort", description: "Quadrant scoring: Quick Win / Strategic / Fill-in / Time Sink" },
  { key: "ai_blend", label: "AI Blend ✦", description: "GPT-4o + Mistral calibrated ensemble" },
  { key: "ml_hybrid", label: "ML Hybrid", description: "GradientBoosting ensemble (600-sample bootstrap)" },
];

const SCORE_COLORS: Record<Algorithm, string> = {
  rice: "#7f77dd",
  wsjf: "#1d9e75",
  ice: "#e05ba0",
  kano: "#e8a838",
  value_effort: "#38bdf8",
  ai_blend: "#ba7517",
  ml_hybrid: "#6366f1",
};

const MOSCOW_BADGE: Record<Feature["moscow"], string> = {
  must: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  should: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  could: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  wont: "bg-zinc-700/40 text-zinc-400 border-zinc-700",
};

const MOSCOW_LABEL: Record<Feature["moscow"], string> = {
  must: "Must",
  should: "Should",
  could: "Could",
  wont: "Won't",
};

interface FeatureFormState {
  name: string;
  description: string;
  context: string;
  epic: string;
  tagsText: string;
  moscow: Feature["moscow"];
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  business_value: number;
  time_criticality: number;
  risk_reduction: number;
  job_size: number;
  ease: number;
  kano_category: Feature["kano_category"];
  satisfaction_gain: number;
  dissatisfaction_risk: number;
  strategic_alignment: number;
  dependency_count: number;
  user_requests: number;
}

const EMPTY_FORM: FeatureFormState = {
  name: "",
  description: "",
  context: "",
  epic: "",
  tagsText: "",
  moscow: "should",
  reach: 5,
  impact: 5,
  confidence: 0.8,
  effort: 3,
  business_value: 5,
  time_criticality: 5,
  risk_reduction: 5,
  job_size: 3,
  ease: 5,
  kano_category: "performance",
  satisfaction_gain: 5,
  dissatisfaction_risk: 5,
  strategic_alignment: 5,
  dependency_count: 0,
  user_requests: 0,
};

function hashTagColor(tag: string): string {
  const palette = [
    "border border-violet-400/40 bg-violet-500/15 text-violet-100",
    "border border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
    "border border-orange-400/40 bg-orange-500/15 text-orange-100",
    "border border-sky-400/40 bg-sky-500/15 text-sky-100",
    "border border-pink-400/40 bg-pink-500/15 text-pink-100",
    "border border-teal-400/40 bg-teal-500/15 text-teal-100",
  ];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

function normalizeTags(tagsText: string): string[] {
  // Normalization keeps tag chips stable and avoids accidental duplicates such
  // as "AI" vs "ai" or trailing spaces copied from user input.
  return tagsText
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .sort((a, b) => {
      const ak = a.includes(":") ? a.split(":", 1)[0] : "zzz";
      const bk = b.includes(":") ? b.split(":", 1)[0] : "zzz";
      return ak === bk ? a.localeCompare(b) : ak.localeCompare(bk);
    });
}

// ── Sub-components ────────────────────────────────────────────────────────────
// The panel stays large, so the small reusable pieces are kept local to avoid
// scattering the presentation logic across many files.

function SliderField({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
  step = 0.1,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  const display = step < 0.09 ? value.toFixed(2) : value % 1 === 0 ? String(value) : value.toFixed(1);
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">{label}</span>
        <span className="font-mono text-sm font-bold tabular-nums text-zinc-100">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-violet-500"
      />
      {hint && <span className="text-[10px] text-zinc-600">{hint}</span>}
    </label>
  );
}

function ScoreHero({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="font-mono text-2xl font-black leading-none tabular-nums" style={{ color }}>
        {Math.round(value)}
      </span>
      <div className="h-1 w-12 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
        />
      </div>
    </div>
  );
}

const SCORE_KEYS: Record<Algorithm, keyof ScoredFeature> = {
  rice: "rice_score",
  wsjf: "wsjf_score",
  ice: "ice_score",
  kano: "kano_score",
  value_effort: "value_effort_score",
  ai_blend: "ai_blend_score",
  ml_hybrid: "ml_hybrid_score",
};

function localScore(features: Feature[]): ScoredFeature[] {
  return features.map((f) => {
    const [ve, quadrant] = calculateValueEffortScore(f);
    return {
      feature: f,
      rice_score: calculateRiceScore(f),
      wsjf_score: calculateWsjfScore(f),
      ice_score: calculateIceScore(f),
      kano_score: calculateKanoScore(f),
      value_effort_score: ve,
      ai_blend_score: 0,
      ml_hybrid_score: 0,
      final_score: 0,
      final_rank: 0,
      quadrant,
      explanation: "",
    };
  });
}

function sortByAlgo(items: ScoredFeature[], algo: Algorithm): ScoredFeature[] {
  const key = SCORE_KEYS[algo];
  return [...items]
    .sort((a, b) => (b[key] as number) - (a[key] as number))
    .map((s, i) => ({ ...s, final_rank: i + 1 }));
}

// ── Main Component ────────────────────────────────────────────────────────────

type FormTab = "basic" | "rice" | "wsjf" | "kano" | "context";

const FORM_TABS: { key: FormTab; label: string }[] = [
  { key: "basic", label: "Basic" },
  { key: "rice", label: "RICE" },
  { key: "wsjf", label: "WSJF" },
  { key: "kano", label: "Kano" },
  { key: "context", label: "Context" },
];

export default function PrioritizationPanel() {
  const [algo, setAlgo] = useState<Algorithm>(() => {
    if (typeof window === "undefined") return "rice";
    const saved = window.localStorage.getItem("postie:prio:algo");
    return (saved as Algorithm) || "rice";
  });
  const [features, setFeatures] = useState<Feature[]>(DEMO_FEATURES);
  // Auto-score on init — no "0.0" on first render
  const [results, setResults] = useState<ScoredFeature[]>(() =>
    sortByAlgo(localScore(DEMO_FEATURES), "rice")
  );
  const [draft, setDraft] = useState<FeatureFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("postie:prio:algo", algo);
  }, [algo]);
  const [formTab, setFormTab] = useState<FormTab>("basic");
  const [groomOpen, setGroomOpen] = useState(false);

  const reloadBacklog = useCallback(async () => {
    try {
      const persisted = await fetchPrioritizationBacklog();
      if (persisted.length > 0) setFeatures(persisted);
    } catch {
      // ignore
    }
  }, []);

  // Load persisted backlog on mount
  useEffect(() => {
    const loadBacklog = async () => {
      try {
        const persisted = await fetchPrioritizationBacklog();
        if (persisted.length > 0) setFeatures(persisted);
      } catch {
        // Keep in-memory defaults when backlog endpoint is unavailable.
      }
    };
    void loadBacklog();
  }, []);

  // Auto re-rank locally whenever features or algorithm change.
  useEffect(() => {
    setResults(sortByAlgo(localScore(features), algo));
  }, [algo, features]);

  // Live preview — recomputes instantly as sliders move
  const livePreview = useMemo(() => {
    const f: Feature = {
      id: "__preview__",
      name: draft.name || "preview",
      description: draft.description,
      context: draft.context,
      epic: draft.epic,
      tags: [],
      reach: draft.reach,
      impact: draft.impact,
      confidence: draft.confidence,
      effort: draft.effort,
      business_value: draft.business_value,
      time_criticality: draft.time_criticality,
      risk_reduction: draft.risk_reduction,
      job_size: draft.job_size,
      ease: draft.ease,
      kano_category: draft.kano_category,
      satisfaction_gain: draft.satisfaction_gain,
      dissatisfaction_risk: draft.dissatisfaction_risk,
      moscow: draft.moscow,
      strategic_alignment: draft.strategic_alignment,
      dependency_count: draft.dependency_count,
      user_requests: draft.user_requests,
    };
    const [ve] = calculateValueEffortScore(f);
    return {
      rice: calculateRiceScore(f),
      wsjf: calculateWsjfScore(f),
      ice: calculateIceScore(f),
      kano: calculateKanoScore(f),
      ve,
    };
  }, [draft]);

  const runScoring = useCallback(
    async (target: Algorithm) => {
      if (!features.length) {
        setError("Backlog is empty — add at least one feature.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const scored = await runPrioritization(features, target);
        setResults(sortByAlgo(scored, target));
        setUsedFallback(false);
      } catch {
        setResults(sortByAlgo(localScore(features), target));
        setUsedFallback(true);
        setError("Backend unavailable — showing client-side scores.");
      } finally {
        setLastRunAt(new Date());
        setLoading(false);
      }
    },
    [features]
  );

  const addFeature = async () => {
    if (!draft.name.trim()) {
      setError("Feature name is required.");
      return;
    }
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `feature-${Date.now()}`;

    const nextFeature: Feature = {
      id,
      name: draft.name.trim(),
      description: draft.description.trim(),
      context: draft.context.trim(),
      epic: draft.epic.trim(),
      tags: normalizeTags(draft.tagsText),
      moscow: draft.moscow,
      reach: draft.reach,
      impact: draft.impact,
      confidence: draft.confidence,
      effort: draft.effort,
      business_value: draft.business_value,
      time_criticality: draft.time_criticality,
      risk_reduction: draft.risk_reduction,
      job_size: draft.job_size,
      ease: draft.ease,
      kano_category: draft.kano_category,
      satisfaction_gain: draft.satisfaction_gain,
      dissatisfaction_risk: draft.dissatisfaction_risk,
      strategic_alignment: draft.strategic_alignment,
      dependency_count: draft.dependency_count,
      user_requests: draft.user_requests,
    };

    const nextFeatures = [...features, nextFeature];
    setFeatures(nextFeatures);
    let persisted = true;
    try {
      await savePrioritizationBacklog(nextFeatures);
    } catch {
      persisted = false;
      setError("Feature added locally, but backlog persistence failed.");
    }
    setDraft(EMPTY_FORM);
    setFormTab("basic");
    setFormOpen(false);
    if (persisted) setError(null);
  };

  const removeFeature = async (featureId: string) => {
    const nextFeatures = features.filter((f) => f.id !== featureId);
    setFeatures(nextFeatures);
    try {
      await deletePrioritizationFeature(featureId);
    } catch {
      try {
        await savePrioritizationBacklog(nextFeatures);
      } catch {
        setError("Feature removed locally, but backlog persistence failed.");
      }
    }
  };

  const lastRunLabel = useMemo(() => {
    if (!lastRunAt) return "Never";
    return lastRunAt.toLocaleTimeString();
  }, [lastRunAt]);

  const epicSuggestions = useMemo(() => {
    const values = new Set<string>(EPIC_PRESETS);
    features.forEach((f) => {
      if (f.epic?.trim()) values.add(f.epic.trim());
    });
    return Array.from(values).sort();
  }, [features]);

  const selectedAlgo = ALGOS.find((a) => a.key === algo) ?? ALGOS[0];

  const currentTabIdx = FORM_TABS.findIndex((t) => t.key === formTab);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">Feature Prioritization</h2>
          <p className="mt-0.5 text-xs text-zinc-400">{features.length} features in backlog</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle form drawer */}
          <button
            type="button"
            onClick={() => setFormOpen((o) => !o)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
              formOpen
                ? "border-violet-600 bg-violet-600/20 text-violet-300"
                : "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
            }`}
          >
            {formOpen ? (
              <ChevronDown className="h-3.5 w-3.5 transition-transform" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {formOpen ? "Close" : "Add feature"}
          </button>
          {/* Groom epic */}
          <button
            type="button"
            onClick={() => setGroomOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:border-violet-500/40 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            title="Generate user stories from an epic via LangGraph"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Groom epic
          </button>
          <label className="sr-only" htmlFor="algo-select">Algorithm</label>
          <div className="flex items-center gap-1.5">
            <select
              id="algo-select"
              value={algo}
              onChange={(e) => setAlgo(e.target.value as Algorithm)}
              className="rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-1.5 text-sm font-semibold text-zinc-100 outline-none focus:border-violet-500"
              title="Choose prioritization method"
            >
              {ALGOS.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
            <InfoTooltip side="bottom" content={ALGO_TOOLTIPS[algo] ?? "Prioritization method."} />
          </div>
          {/* Re-score */}
          <button
            type="button"
            onClick={() => runScoring(algo)}
            disabled={loading || features.length === 0}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {loading ? "Scoring…" : "Re-score"}
          </button>
        </div>
      </div>

      {/* ── Collapsible form drawer ─────────────────────────────────────────── */}
      {formOpen && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Form tab nav + live preview chips */}
          <div className="mb-5 flex items-center gap-1 border-b border-zinc-800 pb-3">
            {FORM_TABS.map((t, i) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setFormTab(t.key)}
                className={`relative rounded-md px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                  formTab === t.key
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span className="mr-1.5 font-mono text-zinc-600">{i + 1}.</span>
                {t.label}
              </button>
            ))}
            {/* Live score preview */}
            <div className="ml-auto flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-[11px]">
              <span className="text-zinc-600">Live preview:</span>
              <span className="font-mono font-bold tabular-nums" style={{ color: "#7f77dd" }}>
                RICE {livePreview.rice.toFixed(0)}
              </span>
              <span className="font-mono font-bold tabular-nums" style={{ color: "#1d9e75" }}>
                WSJF {livePreview.wsjf.toFixed(0)}
              </span>
              <span className="font-mono font-bold tabular-nums" style={{ color: "#e05ba0" }}>
                ICE {livePreview.ice.toFixed(0)}
              </span>
              <span className="font-mono font-bold tabular-nums" style={{ color: "#38bdf8" }}>
                V/E {livePreview.ve.toFixed(0)}
              </span>
            </div>
          </div>

          {/* ── Tab: Basic ────────────────────────────────────────────────── */}
          {formTab === "basic" && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-xs text-zinc-400">
                Feature name *
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                  className="rounded-md border border-zinc-600 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
                  placeholder="e.g. AI sprint auto-planner"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-zinc-400">
                Epic (auto-complete)
                <input
                  list="epic-suggestions"
                  value={draft.epic}
                  onChange={(e) => setDraft((p) => ({ ...p, epic: e.target.value }))}
                  className="rounded-md border border-zinc-600 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
                  placeholder="Select or type a new epic"
                />
                <datalist id="epic-suggestions">
                  {epicSuggestions.map((epic) => (
                    <option key={epic} value={epic} />
                  ))}
                </datalist>
              </label>
              <label className="col-span-full flex flex-col gap-1.5 text-xs text-zinc-400">
                User story + business rules
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                  className="min-h-[96px] rounded-md border border-zinc-600 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
                  placeholder="As a [role], I want [goal], so that [benefit].\nBusiness rules: ..."
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-zinc-400">
                Tags (comma-separated, key:value recommended)
                <input
                  value={draft.tagsText}
                  onChange={(e) => setDraft((p) => ({ ...p, tagsText: e.target.value }))}
                  className="rounded-md border border-zinc-600 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
                  placeholder="domain:auth, team:backend, risk:security"
                />
                <span className="text-[10px] text-zinc-500">Use consistent prefixes so tags stay organized at the same level.</span>
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-zinc-400">
                MoSCoW Priority
                <select
                  value={draft.moscow}
                  onChange={(e) => setDraft((p) => ({ ...p, moscow: e.target.value as Feature["moscow"] }))}
                  className="rounded-md border border-zinc-600 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
                >
                  <option value="must">Must — critical, non-negotiable</option>
                  <option value="should">Should — important, high priority</option>
                  <option value="could">Could — nice-to-have, deferrable</option>
                  <option value="wont">Won't — out of scope</option>
                </select>
              </label>
            </div>
          )}

          {/* ── Tab: RICE ─────────────────────────────────────────────────── */}
          {formTab === "rice" && (
            <div className="grid gap-6 md:grid-cols-2">
              <SliderField
                label="Reach — users affected (0–10)"
                value={draft.reach}
                onChange={(v) => setDraft((p) => ({ ...p, reach: v }))}
                hint="0 = nobody, 10 = all users"
              />
              <SliderField
                label="Impact — benefit per user (0–10)"
                value={draft.impact}
                onChange={(v) => setDraft((p) => ({ ...p, impact: v }))}
                hint="0 = minimal, 10 = massive"
              />
              <SliderField
                label="Confidence — estimate reliability (0.1–1.0)"
                value={draft.confidence}
                onChange={(v) => setDraft((p) => ({ ...p, confidence: v }))}
                min={0.1}
                max={1}
                step={0.05}
                hint="0.5 = gut feeling, 1.0 = validated with data"
              />
              <SliderField
                label="Effort — person-weeks (0.5–20)"
                value={draft.effort}
                onChange={(v) => setDraft((p) => ({ ...p, effort: v }))}
                min={0.5}
                max={20}
                step={0.5}
                hint="0.5 = few hours, 20 = large multi-sprint project"
              />
            </div>
          )}

          {/* ── Tab: WSJF ─────────────────────────────────────────────────── */}
          {formTab === "wsjf" && (
            <div className="grid gap-6 md:grid-cols-2">
              <SliderField
                label="Business Value (0–10)"
                value={draft.business_value}
                onChange={(v) => setDraft((p) => ({ ...p, business_value: v }))}
                hint="Revenue impact / strategic importance"
              />
              <SliderField
                label="Time Criticality (0–10)"
                value={draft.time_criticality}
                onChange={(v) => setDraft((p) => ({ ...p, time_criticality: v }))}
                hint="0 = anytime, 10 = critical deadline / SLA breach"
              />
              <SliderField
                label="Risk Reduction (0–10)"
                value={draft.risk_reduction}
                onChange={(v) => setDraft((p) => ({ ...p, risk_reduction: v }))}
                hint="How much technical or business risk does it mitigate?"
              />
              <SliderField
                label="Job Size (0.5–10)"
                value={draft.job_size}
                onChange={(v) => setDraft((p) => ({ ...p, job_size: v }))}
                min={0.5}
                step={0.5}
                hint="Team capacity required — smaller = faster to ship"
              />
            </div>
          )}

          {/* ── Tab: Kano ─────────────────────────────────────────────────── */}
          {formTab === "kano" && (
            <div className="grid gap-6 md:grid-cols-2">
              <label className="col-span-full flex flex-col gap-1.5 text-xs text-zinc-400">
                Kano Category
                <select
                  value={draft.kano_category}
                  onChange={(e) => setDraft((p) => ({ ...p, kano_category: e.target.value as Feature["kano_category"] }))}
                  className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
                >
                  <option value="must_be">Must-be — absence causes dissatisfaction (login, security)</option>
                  <option value="performance">Performance — more is better, less is worse (speed)</option>
                  <option value="delighter">Delighter — unexpected, creates delight (AI suggestions)</option>
                  <option value="indifferent">Indifferent — users don't care either way</option>
                </select>
              </label>
              <SliderField
                label="Satisfaction Gain (0–10)"
                value={draft.satisfaction_gain}
                onChange={(v) => setDraft((p) => ({ ...p, satisfaction_gain: v }))}
                hint="How much delight when the feature is present?"
              />
              <SliderField
                label="Dissatisfaction Risk (0–10)"
                value={draft.dissatisfaction_risk}
                onChange={(v) => setDraft((p) => ({ ...p, dissatisfaction_risk: v }))}
                hint="How much pain when the feature is absent?"
              />
              <SliderField
                label="Ease — implementation simplicity (ICE)"
                value={draft.ease}
                onChange={(v) => setDraft((p) => ({ ...p, ease: v }))}
                hint="0 = very hard, 10 = trivial to ship"
              />
            </div>
          )}

          {/* ── Tab: Context ──────────────────────────────────────────────── */}
          {formTab === "context" && (
            <div className="grid gap-6 md:grid-cols-2">
              <label className="col-span-full flex flex-col gap-1.5 text-xs text-zinc-400">
                Prioritization context (text)
                <textarea
                  value={draft.context}
                  onChange={(e) => setDraft((p) => ({ ...p, context: e.target.value }))}
                  className="min-h-[84px] rounded-md border border-zinc-600 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
                  placeholder="Context example: enterprise customer deadline end of month, SSO blocker for contract signature."
                />
                <span className="text-[10px] text-zinc-500">Used to capture business urgency and delivery constraints in plain language.</span>
              </label>
              <SliderField
                label="Strategic Alignment (0–10)"
                value={draft.strategic_alignment}
                onChange={(v) => setDraft((p) => ({ ...p, strategic_alignment: v }))}
                hint="OKR / company strategy fit — multiplier on RICE & WSJF"
              />
              <label className="flex flex-col gap-1.5 text-xs text-zinc-400">
                <span title="How many users/customers explicitly requested this feature">User Requests (count)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={draft.user_requests}
                  onChange={(e) => setDraft((p) => ({ ...p, user_requests: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="rounded-md border border-zinc-600 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
                  placeholder="e.g. 42 support tickets"
                />
                <span className="text-[10px] text-zinc-600">Bayesian demand signal — log-smoothed in RICE v2</span>
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-zinc-400">
                Dependency Count
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={draft.dependency_count}
                  onChange={(e) => setDraft((p) => ({ ...p, dependency_count: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="rounded-md border border-zinc-600 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
                  placeholder="Number of features this unblocks"
                />
                <span className="text-[10px] text-zinc-600">WSJF dependency multiplier: +5% per dependency, up to +30%</span>
              </label>
            </div>
          )}

          {/* ── Form footer ───────────────────────────────────────────────── */}
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-4">
            {currentTabIdx < FORM_TABS.length - 1 && (
              <button
                type="button"
                onClick={() => setFormTab(FORM_TABS[currentTabIdx + 1].key)}
                className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
              >
                Next: {FORM_TABS[currentTabIdx + 1].label} →
              </button>
            )}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => { setDraft(EMPTY_FORM); setFormTab("basic"); }}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={addFeature}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <Plus className="h-3.5 w-3.5" />
                Add to backlog
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Algorithm helper ────────────────────────────────────────────────── */}
      <div className="flex items-start gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200">
        <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" />
        <div>
          <p className="flex items-center gap-1.5 font-semibold text-zinc-100">
            {selectedAlgo.label}
            <InfoTooltip side="right" content={ALGO_TOOLTIPS[selectedAlgo.key] ?? selectedAlgo.description} />
          </p>
          <p className="text-zinc-300">{selectedAlgo.description}</p>
          {selectedAlgo.key === "ai_blend" && (
            <p className="mt-1 text-[11px] text-zinc-400">Uses GPT-4o + Mistral for explainable score recommendations.</p>
          )}
          {selectedAlgo.key === "ml_hybrid" && (
            <p className="mt-1 text-[11px] text-zinc-400">Uses local GradientBoosting ensemble (fast, deterministic, no API dependency).</p>
          )}
        </div>
      </div>

      {/* ── Status bar ──────────────────────────────────────────────────────── */}
      <div
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
          error
            ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
            : "border-zinc-800 bg-zinc-950/60 text-zinc-300"
        }`}
      >
        {error ? (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
        )}
        <span>
          {error ?? (
            <>
              Last run: <span className="font-mono">{lastRunLabel}</span>
              {" · "}Algorithm: <span className="font-mono uppercase">{algo}</span>
              {usedFallback && " · client-side fallback"}
            </>
          )}
        </span>
      </div>

      {/* ── Table header ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_72px_120px_32px_32px] gap-3 px-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-300">
        <span>Feature</span>
        <span className="text-center">Score</span>
        <span>Meta</span>
        <span className="text-center">#</span>
        <span />
      </div>

      {/* ── Feature rows ────────────────────────────────────────────────────── */}
      <ul className="flex flex-col gap-2">
        {results.length === 0 && (
          <li className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-8 text-center text-sm text-zinc-400">
            No features yet —{" "}
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="font-semibold text-zinc-300 underline underline-offset-2 hover:text-violet-400"
            >
              Add a feature
            </button>{" "}
            to start prioritizing.
          </li>
        )}
        {results.map((s) => {
          const score = s[SCORE_KEYS[algo]] as number;
          return (
            <li
              key={s.feature.id}
              className="grid grid-cols-[1fr_72px_120px_32px_32px] items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900/90 px-4 py-3 transition-colors hover:border-zinc-500"
            >
              {/* Feature info */}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-100">{s.feature.name}</p>
                <p className="mt-0.5 text-[11px] text-zinc-300">{s.feature.epic || "No epic"}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${MOSCOW_BADGE[s.feature.moscow]}`}>
                    {MOSCOW_LABEL[s.feature.moscow]}
                  </span>
                  <span className="rounded border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-100">
                    Requests {s.feature.user_requests}
                  </span>
                  {s.feature.tags.map((tag) => (
                    <span key={tag} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${hashTagColor(tag)}`}>
                      {tag}
                    </span>
                  ))}
                </div>
                {s.feature.context && (
                  <p className="mt-1 text-[10px] text-zinc-400 line-clamp-2">Context: {s.feature.context}</p>
                )}
                {s.explanation && (
                  <p className="mt-1 line-clamp-2 text-[10px] text-zinc-300">{s.explanation}</p>
                )}
              </div>

              {/* Hero score — big number + thin bar */}
              <ScoreHero value={score} color={SCORE_COLORS[algo]} />

              {/* Meta */}
              <div className="font-mono text-[11px] text-zinc-200">
                <p>Effort: {s.feature.effort}w</p>
                <p>Conf: {Math.round(s.feature.confidence * 100)}%</p>
                {s.quadrant && <p className="truncate text-zinc-300">{s.quadrant}</p>}
              </div>

              {/* Rank badge */}
              <div
                aria-label={`Rank ${s.final_rank} of ${results.length}`}
                className={`flex h-7 w-7 items-center justify-center rounded-md font-mono text-[11px] font-bold ${
                  s.final_rank === 1
                    ? "border border-violet-400/60 bg-violet-500/30 text-violet-50"
                    : s.final_rank === 2
                    ? "border border-emerald-400/60 bg-emerald-500/30 text-emerald-50"
                    : s.final_rank === 3
                    ? "border border-orange-400/60 bg-orange-500/30 text-orange-50"
                    : "border border-zinc-600 bg-zinc-800 text-zinc-100"
                }`}
              >
                {s.final_rank}
              </div>

              {/* Delete */}
              <button
                type="button"
                aria-label={`Remove ${s.feature.name}`}
                onClick={() => removeFeature(s.feature.id)}
                className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <TrendingUp className="h-3.5 w-3.5" />
        <span>Scores normalized 0–100. Switch algorithm to re-rank instantly. Re-score calls the backend for AI/ML scoring.</span>
      </div>

      <GroomEpicModal
        open={groomOpen}
        onClose={() => setGroomOpen(false)}
        onPersisted={reloadBacklog}
      />
    </div>
  );
}

