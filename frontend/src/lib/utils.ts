import type { Feature } from "../hooks/usePrioritization";

export function calculateRiceScore(feature: Feature): number {
  const raw = (feature.reach * feature.impact * feature.confidence) / Math.max(feature.effort, 0.1);
  return Math.round(Math.min(raw, 100) * 100) / 100;
}

export function calculateWsjfScore(feature: Feature): number {
  const cod = feature.business_value + feature.time_criticality + feature.risk_reduction;
  const raw = cod / Math.max(feature.job_size, 0.1);
  return Math.round(Math.min((raw / 30) * 100, 100) * 100) / 100;
}

export function calculateIceScore(feature: Feature): number {
  const raw = feature.impact * (feature.confidence ** 2) * feature.ease;
  return Math.round(Math.min(Math.max(raw, 0), 100) * 100) / 100;
}

const KANO_BASE: Record<Feature["kano_category"], number> = {
  must_be: 85, performance: 50, delighter: 30, indifferent: 5,
};
const KANO_WEIGHTS: Record<Feature["kano_category"], [number, number]> = {
  must_be:     [0.10, 0.90],
  performance: [0.55, 0.45],
  delighter:   [0.80, 0.20],
  indifferent: [0.10, 0.10],
};

export function calculateKanoScore(feature: Feature): number {
  const base = KANO_BASE[feature.kano_category] ?? 50;
  const [satW, disW] = KANO_WEIGHTS[feature.kano_category] ?? [0.55, 0.45];
  const adjustment = (satW * feature.satisfaction_gain + disW * feature.dissatisfaction_risk) * 2.0;
  return Math.round(Math.min(Math.max(base + adjustment - 10, 0), 100) * 100) / 100;
}

export function calculateValueEffortScore(feature: Feature): [number, string] {
  const value = feature.business_value * 0.40 + feature.impact * 0.35 + feature.strategic_alignment * 0.25;
  const compositeEffort = (feature.effort / 2 + feature.job_size) / 2;
  const highValue = value > 5.5;
  const lowEffort = compositeEffort < 5.0;
  let score: number;
  let quadrant: string;
  if (highValue && lowEffort) {
    score = 85 + (value - 5.5) * 3.5 - compositeEffort * 0.5;
    quadrant = "Quick Win 🚀";
  } else if (highValue) {
    score = 60 + (value - 5.5) * 5 - (compositeEffort - 5) * 1.5;
    quadrant = "Strategic 🏔";
  } else if (lowEffort) {
    score = 25 + value * 3 - compositeEffort * 0.5;
    quadrant = "Fill-in 🌿";
  } else {
    score = Math.max(0, value * 2 - compositeEffort * 1.5);
    quadrant = "Time Sink ⚠️";
  }
  return [Math.round(Math.min(Math.max(score, 0), 100) * 100) / 100, quadrant];
}

export function moscowScoreFromPriority(moscow: Feature["moscow"]): number {
  return { must: 100, should: 75, could: 50, wont: 0 }[moscow];
}
