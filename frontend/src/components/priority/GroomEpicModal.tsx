"use client";

import { useState } from "react";
import { Loader2, Sparkles, Wand2, X } from "lucide-react";
import { GroomingResponse, groomEpic } from "../../lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onPersisted?: () => void;
}

export default function GroomEpicModal({ open, onClose, onPersisted }: Props) {
  const [epic, setEpic] = useState("");
  const [numStories, setNumStories] = useState(5);
  const [persist, setPersist] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GroomingResponse | null>(null);

  if (!open) return null;

  const handleRun = async () => {
    if (epic.trim().length < 5) {
      setError("Describe the epic in at least a few words.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await groomEpic(epic, numStories, persist);
      setResult(r);
      if (persist && r.persisted_ids.length > 0) onPersisted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grooming failed");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEpic("");
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-violet-300" />
            <h3 className="text-sm font-semibold text-zinc-100">Groom Epic (LangGraph)</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Epic description
            <textarea
              value={epic}
              onChange={(e) => setEpic(e.target.value)}
              placeholder="e.g. Overhaul user onboarding with SSO, guided tour, and progress tracking"
              className="min-h-[80px] rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-100"
            />
          </label>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              # stories
              <input
                type="number"
                min={1}
                max={10}
                value={numStories}
                onChange={(e) => setNumStories(Number(e.target.value))}
                className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={persist}
                onChange={(e) => setPersist(e.target.checked)}
              />
              Add to backlog
            </label>
            <button
              type="button"
              onClick={handleRun}
              disabled={loading}
              className="ml-auto flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-500/25 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate stories
            </button>
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto border-t border-zinc-800 px-5 py-4">
          {!result && !loading && (
            <p className="text-xs italic text-zinc-600">
              Pipeline: generate titles → write acceptance criteria → estimate RICE → persist.
            </p>
          )}
          {result && (
            <div className="space-y-3">
              {result.persisted_ids.length > 0 && (
                <p className="text-xs text-emerald-300">
                  ✓ {result.persisted_ids.length} features added to backlog.
                </p>
              )}

              {result.trace.length > 0 && (
                <details className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3" open>
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-amber-300">
                    Agent trace ({result.trace.length} steps · {result.retries} retr{result.retries === 1 ? "y" : "ies"})
                  </summary>
                  <ol className="mt-2 space-y-1 text-[11px] text-amber-100/90">
                    {result.trace.map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="min-w-[4ch] font-mono text-amber-300">{i + 1}.</span>
                        <span className="min-w-[70px] font-mono font-semibold">{step.node}</span>
                        <span className="flex-1">
                          {step.verdict && (
                            <span
                              className={`mr-1 rounded px-1 font-mono text-[10px] ${
                                step.verdict === "ok"
                                  ? "bg-emerald-500/20 text-emerald-200"
                                  : "bg-rose-500/20 text-rose-200"
                              }`}
                            >
                              {step.verdict}
                            </span>
                          )}
                          {step.note}
                          {step.issues && step.issues.length > 0 && (
                            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[10px] text-amber-200/70">
                              {step.issues.map((iss, j) => (
                                <li key={j}>
                                  <span className="font-mono">#{iss.story_index}</span>: {iss.problem}
                                </li>
                              ))}
                            </ul>
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                </details>
              )}

              {result.stories.map((s, i) => (
                <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-zinc-100">{s.title}</h4>
                    <span className="font-mono text-[10px] text-violet-300">
                      R:{s.reach} I:{s.impact} C:{s.confidence} E:{s.effort}w
                    </span>
                  </div>
                  {s.as_a && (
                    <p className="mt-1 text-xs text-zinc-300">
                      <strong>As a</strong> {s.as_a}, <strong>I want</strong> {s.i_want},{" "}
                      <strong>so that</strong> {s.so_that}.
                    </p>
                  )}
                  {s.acceptance_criteria.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-zinc-400">
                      {s.acceptance_criteria.map((c, j) => <li key={j}>{c}</li>)}
                    </ul>
                  )}
                  {s.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {s.tags.map((t) => (
                        <span key={t} className="rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
