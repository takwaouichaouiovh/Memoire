"use client";

import { useState } from "react";
import { Bot, Loader2, Sparkles, GitBranch, AlertTriangle } from "lucide-react";
import { runSupervisor, SupervisorResponse, SupervisorStep } from "../../lib/api";

const ALGOS = ["rice", "wsjf", "ice", "kano", "value_effort", "ml_hybrid"] as const;

export default function SupervisorPanel() {
  const [goal, setGoal] = useState("Prepare next sprint from current backlog");
  const [epic, setEpic] = useState("");
  const [velocity, setVelocity] = useState(20);
  const [algorithm, setAlgorithm] = useState<string>("rice");
  const [respectDeps, setRespectDeps] = useState(true);
  const [useLlmRouter, setUseLlmRouter] = useState(false);
  const [persistGroomed, setPersistGroomed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SupervisorResponse | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await runSupervisor({
        goal,
        epic: epic.trim() || undefined,
        velocity,
        algorithm,
        respect_dependencies: respectDeps,
        persist_groomed_stories: persistGroomed,
        use_llm_router: useLlmRouter,
      });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Supervisor run failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-6 py-3">
        <Bot className="h-4 w-4 text-violet-300" />
        <h3 className="text-sm font-semibold text-zinc-100">Supervisor (multi-agent)</h3>
        <span className="font-mono text-[10px] text-zinc-500">
          groom → prioritize → plan → summary
        </span>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[1fr_1.2fr]">
        {/* Form */}
        <div className="space-y-4 overflow-y-auto border-b border-zinc-800 px-6 py-4 lg:border-b-0 lg:border-r">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Goal
            <textarea
              rows={2}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Optional epic (will be groomed into stories first)
            <textarea
              rows={3}
              value={epic}
              placeholder="e.g. Implement SSO with multi-tenant support"
              onChange={(e) => setEpic(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
            />
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              Velocity
              <input
                type="number"
                min={1}
                value={velocity}
                onChange={(e) => setVelocity(Number(e.target.value))}
                className="w-28 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              Algorithm
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value)}
                className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
              >
                {ALGOS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="space-y-2 text-xs text-zinc-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={respectDeps}
                onChange={(e) => setRespectDeps(e.target.checked)}
              />
              Respect dependencies (ILP solver)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={persistGroomed}
                onChange={(e) => setPersistGroomed(e.target.checked)}
              />
              Persist groomed stories to backlog
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useLlmRouter}
                onChange={(e) => setUseLlmRouter(e.target.checked)}
              />
              Use LLM router (slower, more flexible)
            </label>
          </div>
          <button
            type="button"
            onClick={handleRun}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-500/25 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Run supervisor
          </button>
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>

        {/* Result */}
        <div className="space-y-4 overflow-y-auto px-6 py-4">
          {!result && !loading && (
            <p className="text-xs text-zinc-500">
              Run the supervisor to see its trace, sprint plan, and final summary.
            </p>
          )}
          {loading && (
            <p className="flex items-center gap-2 text-xs text-zinc-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Orchestrating sub-agents…
            </p>
          )}
          {result && (
            <>
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  Summary
                </h4>
                <p className="whitespace-pre-line rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200">
                  {result.summary}
                </p>
              </section>

              {result.sprint_plan && (
                <section>
                  <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
                    <GitBranch className="h-3 w-3" />
                    Sprint plan ({result.sprint_plan.solver}, optimal={String(result.sprint_plan.optimal)})
                  </h4>
                  <div className="flex flex-wrap gap-2 text-[11px] text-zinc-400">
                    <span>util {result.sprint_plan.utilization}%</span>
                    <span>value {result.sprint_plan.total_value.toFixed(1)}</span>
                    <span>{result.sprint_plan.selected.length} selected</span>
                    <span>{result.sprint_plan.deferred.length} deferred</span>
                  </div>
                  {result.sprint_plan.diagnostics?.cycles?.length > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-300">
                      <AlertTriangle className="h-3 w-3" />
                      Auto-broke {result.sprint_plan.diagnostics.cycles.length} cycle(s)
                    </p>
                  )}
                  <ul className="mt-2 space-y-1 text-xs text-zinc-200">
                    {result.sprint_plan.selected.map((s) => (
                      <li
                        key={s.feature.id}
                        className="flex items-center justify-between gap-2 rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1"
                      >
                        <span className="truncate">{s.feature.name}</span>
                        <span className="font-mono text-[10px] text-zinc-400">
                          {s.score.toFixed(1)} · {s.effort}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Trace ({result.iterations} iterations)
                </h4>
                <ol className="space-y-1 text-[11px]">
                  {result.trace.map((step: SupervisorStep, i: number) => (
                    <li
                      key={i}
                      className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-zinc-300"
                    >
                      <span className="text-violet-300">{step.node}</span>
                      {step.decision && (
                        <span className="ml-2 text-emerald-300">→ {step.decision}</span>
                      )}
                      {step.note && <span className="ml-2 text-zinc-400">— {step.note}</span>}
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
