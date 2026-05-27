export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Source {
  name: string;
  page?: number;
  snippet?: string;
}

export interface ChatApiResponse {
  answer: string;
  model_used: string;
  sources: Source[];
}

export interface DocumentSummary {
  name: string;
  chunks: number;
}

export interface DocumentListResponse {
  documents: DocumentSummary[];
}

export interface DocumentUploadResponse {
  filename: string;
  status: string;
  chunks: number;
  message: string;
}

export interface DocumentDeleteResponse {
  deleted: string;
  note: string;
}

export interface HealthResponse {
  status: string;
  version: string;
}

export interface PrioritizationBacklogFeature {
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
  moscow: "must" | "should" | "could" | "wont";
  tags: string[];
  epic: string;
  // v2 fields (defaulted by backend Pydantic model)
  ease: number;
  kano_category: "must_be" | "performance" | "delighter" | "indifferent";
  satisfaction_gain: number;
  dissatisfaction_risk: number;
  strategic_alignment: number;
  dependency_count: number;
  user_requests: number;
}

interface PrioritizationBacklogResponse {
  features: PrioritizationBacklogFeature[];
  total: number;
}

interface PrioritizationBacklogSummaryResponse {
  total: number;
}

interface PrioritizationBacklogDeleteResponse {
  deleted: string;
  total: number;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { detail?: string };
      detail = body.detail ? ` - ${body.detail}` : "";
    } catch {
      // Non-JSON error body: keep status-only message
    }
    throw new Error(`API error: ${res.status}${detail}`);
  }
  return res.json() as Promise<T>;
}

export async function postJson<TRequest, TResponse>(
  path: string,
  payload: TRequest
): Promise<TResponse> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<TResponse>(res);
}

export async function getJson<TResponse>(path: string): Promise<TResponse> {
  const res = await fetch(`${API_BASE}${path}`);
  return handleResponse<TResponse>(res);
}

export async function deleteJson<TResponse>(path: string): Promise<TResponse> {
  const res = await fetch(`${API_BASE}${path}`, { method: "DELETE" });
  return handleResponse<TResponse>(res);
}

export async function fetchHealth(): Promise<HealthResponse> {
  return getJson<HealthResponse>("/health");
}

export interface ResetDemoResponse {
  backlog_cleared: boolean;
  sessions_cleared: boolean;
}

export async function resetDemo(): Promise<ResetDemoResponse> {
  return postJson<Record<string, never>, ResetDemoResponse>("/api/admin/reset-demo", {});
}

export async function fetchDocuments(): Promise<DocumentSummary[]> {
  const data = await getJson<DocumentListResponse>("/api/documents/");
  return data.documents;
}

export async function deleteDocument(filename: string): Promise<DocumentDeleteResponse> {
  return deleteJson<DocumentDeleteResponse>(`/api/documents/${encodeURIComponent(filename)}`);
}

export async function uploadDocument(file: File): Promise<DocumentUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/documents/upload`, { method: "POST", body: form });
  return handleResponse<DocumentUploadResponse>(res);
}

export async function clearChatSession(sessionId: string): Promise<{ cleared: string }> {
  return deleteJson<{ cleared: string }>(`/api/chat/session/${encodeURIComponent(sessionId)}`);
}

export async function fetchPrioritizationBacklog(): Promise<PrioritizationBacklogFeature[]> {
  const data = await getJson<PrioritizationBacklogResponse>("/api/prioritization/backlog");
  return data.features;
}

export async function savePrioritizationBacklog(features: PrioritizationBacklogFeature[]): Promise<number> {
  const data = await fetch(`${API_BASE}/api/prioritization/backlog`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ features }),
  });
  const parsed = await handleResponse<PrioritizationBacklogSummaryResponse>(data);
  return parsed.total;
}

export async function deletePrioritizationFeature(featureId: string): Promise<number> {
  const data = await deleteJson<PrioritizationBacklogDeleteResponse>(
    `/api/prioritization/backlog/${encodeURIComponent(featureId)}`
  );
  return data.total;
}

// ─── Agentic features ─────────────────────────────────────────────────────────

export interface SprintPlanItem {
  feature: PrioritizationBacklogFeature;
  score: number;
  effort: number;
  rank: number;
}

export interface SprintPlan {
  algorithm: string;
  velocity: number;
  selected: SprintPlanItem[];
  deferred: SprintPlanItem[];
  total_effort: number;
  total_value: number;
  utilization: number;
  strategy: "knapsack" | "greedy_fallback";
}

export async function planSprint(
  features: PrioritizationBacklogFeature[],
  velocity: number,
  algorithm: string = "rice",
  use_ai_blend: boolean = false
): Promise<SprintPlan> {
  return postJson<unknown, SprintPlan>("/api/prioritization/sprint-plan", {
    features,
    velocity,
    algorithm,
    use_ai_blend,
  });
}

export interface RetroActionItem {
  title: string;
  owner?: string | null;
  due?: string | null;
}

export interface RetroRisk {
  title: string;
  severity: "low" | "medium" | "high";
  mitigation: string;
}

export interface RetroResponse {
  action_items: RetroActionItem[];
  risks: RetroRisk[];
  wins: string[];
  blockers: string[];
  summary: string;
}

export interface RetroAnalyzePayload {
  notes: string;
  action_items?: RetroActionItem[];
  risks?: RetroRisk[];
  wins?: string[];
  blockers?: string[];
}

export async function analyzeRetro(payload: RetroAnalyzePayload): Promise<RetroResponse> {
  return postJson<RetroAnalyzePayload, RetroResponse>("/api/agents/retro", payload);
}

export interface GroomedStory {
  title: string;
  as_a: string;
  i_want: string;
  so_that: string;
  acceptance_criteria: string[];
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  tags: string[];
}

export interface AgentValidationIssue {
  story_index: number;
  problem: string;
  suggestion: string;
}

export interface AgentStep {
  node: string;
  verdict?: string;
  issues?: AgentValidationIssue[];
  note?: string;
}

export interface GroomingResponse {
  epic: string;
  stories: GroomedStory[];
  persisted_ids: string[];
  trace: AgentStep[];
  retries: number;
}

export async function groomEpic(
  epic: string,
  num_stories: number = 5,
  persist: boolean = true
): Promise<GroomingResponse> {
  return postJson<unknown, GroomingResponse>("/api/agents/groom-epic", {
    epic,
    num_stories,
    persist,
  });
}

export interface AssistantToolCall {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface AssistantResponse {
  answer: string;
  tool_calls: AssistantToolCall[];
  iterations: number;
}

export async function chatAssistant(message: string, sessionId: string): Promise<AssistantResponse> {
  return postJson<{ message: string; session_id: string }, AssistantResponse>(
    "/api/agents/assistant",
    { message, session_id: sessionId }
  );
}

export async function clearAssistantSession(sessionId: string): Promise<{ cleared: string }> {
  return deleteJson<{ cleared: string }>(`/api/agents/assistant/session/${encodeURIComponent(sessionId)}`);
}

// ── Sessions (persistent chat history) ───────────────────────────────────────

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  sources?: Source[];
  tool_calls?: AssistantToolCall[];
}

export interface SessionSummary {
  id: string;
  title: string;
  mode: "chat" | "agent";
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface SessionDetail {
  id: string;
  title: string;
  mode: "chat" | "agent";
  created_at: string;
  updated_at: string;
  messages: StoredMessage[];
}

interface SessionListApiResponse {
  sessions: SessionSummary[];
}

export async function fetchSessions(): Promise<SessionSummary[]> {
  const data = await getJson<SessionListApiResponse>("/api/sessions/");
  return data.sessions;
}

export async function fetchSession(sessionId: string): Promise<SessionDetail> {
  return getJson<SessionDetail>(`/api/sessions/${encodeURIComponent(sessionId)}`);
}

export async function renameSession(sessionId: string, title: string): Promise<SessionSummary> {
  const res = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  return handleResponse<SessionSummary>(res);
}

export async function deleteSession(sessionId: string): Promise<{ deleted: string }> {
  return deleteJson<{ deleted: string }>(`/api/sessions/${encodeURIComponent(sessionId)}`);
}
