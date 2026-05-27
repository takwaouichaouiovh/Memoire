import { postJson } from "../lib/api";

export type Algorithm = "rice" | "wsjf" | "ice" | "kano" | "value_effort" | "ai_blend" | "ml_hybrid";

export interface Feature {
  id: string;
  name: string;
  description: string;
  context: string;
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  business_value: number;
  time_criticality: number;
  risk_reduction: number;
  job_size: number;
  ease: number;
  kano_category: "must_be" | "performance" | "delighter" | "indifferent";
  satisfaction_gain: number;
  dissatisfaction_risk: number;
  moscow: "must" | "should" | "could" | "wont";
  tags: string[];
  epic: string;
  strategic_alignment: number;
  dependency_count: number;
  user_requests: number;
}

export interface ScoredFeature {
  feature: Feature;
  rice_score: number;
  wsjf_score: number;
  ice_score: number;
  kano_score: number;
  value_effort_score: number;
  ai_blend_score: number;
  ml_hybrid_score: number;
  final_score: number;
  final_rank: number;
  quadrant: string;
  explanation: string;
}

interface PrioritizeRequest {
  features: Feature[];
  algorithm: Algorithm;
  use_ai_blend: boolean;
}

interface PrioritizeResponse {
  algorithm: Algorithm;
  results: ScoredFeature[];
  total: number;
}

export async function runPrioritization(
  features: Feature[],
  algorithm: Algorithm
): Promise<ScoredFeature[]> {
  const payload: PrioritizeRequest = {
    features,
    algorithm,
    use_ai_blend: algorithm === "ai_blend",
  };

  const data = await postJson<PrioritizeRequest, PrioritizeResponse>(
    "/api/prioritization/",
    payload
  );

  return data.results;
}
