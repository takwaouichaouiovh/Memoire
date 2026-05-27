"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, Sparkles, Trophy, Zap } from "lucide-react";
import { RetroAnalyzePayload, RetroResponse, analyzeRetro } from "../../lib/api";

const SAMPLE = `Sprint 14 retro notes:
- We shipped the new onboarding flow on time, conversion went up 12%.
- Pair programming worked well, keep it for complex tickets.
- The CI pipeline was flaky 3 days in a row — blocked deploys.
- Alice will own the CI investigation this week.
- Risk: dependency on the auth team's SSO migration is slipping.
- Documentation still lagging behind feature work.`;

const SAMPLE_ACTIONS = `Create code-review SLA | Aicha | 2026-06-03
Set support shield rotation | Karim | 2026-06-04`;

const SAMPLE_RISKS = `SSO tenant not ready | high | Ask customer for fallback test tenant
Two devs on PTO next sprint | medium | Reduce committed story points by 20%`;

const SEVERITY: Record<string, string> = {
  low: "border-sky-500/40 bg-sky-500/15 text-sky-100",
  medium: "border-amber-500/40 bg-amber-500/15 text-amber-100",
  high: "border-rose-500/40 bg-rose-500/15 text-rose-100",
};

function parseLineList(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseActions(value: string): RetroAnalyzePayload["action_items"] {
  return parseLineList(value).map((line) => {
    const [title, owner, due] = line.split("|").map((s) => s.trim());
    return {
      title,
      owner: owner || undefined,
      due: due || undefined,
    };
  });
}

function parseRisks(value: string): RetroAnalyzePayload["risks"] {
  return parseLineList(value)
    .map((line) => {
      const [title, severityRaw, mitigation] = line.split("|").map((s) => s.trim());
      const severity = (severityRaw || "medium").toLowerCase();
      if (severity !== "low" && severity !== "medium" && severity !== "high") return null;
      return {
        title,
        severity,
        mitigation: mitigation || "",
      } as const;
    })
    .filter((v): v is NonNullable<typeof v> => Boolean(v));
}

export default function RetroPanel() {
  const [notes, setNotes] = useState("");
  const [manualActions, setManualActions] = useState("");
  const [manualRisks, setManualRisks] = useState("");
  const [manualWins, setManualWins] = useState("");
  const [manualBlockers, setManualBlockers] = useState("");
  const [result, setResult] = useState<RetroResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasStructuredInput = useMemo(
    () =>
      manualActions.trim().length > 0 ||
      manualRisks.trim().length > 0 ||
      manualWins.trim().length > 0 ||
      manualBlockers.trim().length > 0,
    [manualActions, manualRisks, manualWins, manualBlockers]
  );

  const handleAnalyze = async () => {
    if (notes.trim().length < 10 && !hasStructuredInput) {
      setError("Provide notes (>=10 chars) or fill at least one structured section.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload: RetroAnalyzePayload = {
        notes,
        action_items: parseActions(manualActions),
        risks: parseRisks(manualRisks),
        wins: parseLineList(manualWins),
        blockers: parseLineList(manualBlockers),
      };
      setResult(await analyzeRetro(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retro analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSample = () => {
    setNotes(SAMPLE);
    setManualActions(SAMPLE_ACTIONS);
    setManualRisks(SAMPLE_RISKS);
    setManualWins("Pair programming worked\nOnboarding completed in 4 days");
    setManualBlockers("CI flaky pipeline\nOpenAI outage impacted tests");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-violet-300" />
          <h3 className="text-sm font-semibold text-zinc-100">Retrospective Analyzer</h3>
        </div>
        <button
          type="button"
          onClick={handleLoadSample}
          className="rounded-lg border border-zinc-600 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-400"
        >
          Load sample
        </button>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto px-6 py-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Meeting notes (optional if structured sections are filled)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Paste raw retro notes here (FR or EN)..."
            className="min-h-[160px] rounded-lg border border-zinc-600 bg-zinc-950 p-3 font-mono text-xs text-zinc-100 placeholder:text-zinc-500"
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                Manual action items
              </label>
              <textarea
                value={manualActions}
                onChange={(e) => setManualActions(e.target.value)}
                placeholder="One per line: title | owner | due"
                className="min-h-[120px] w-full rounded-lg border border-zinc-600 bg-zinc-950 p-2 font-mono text-[11px] text-zinc-100 placeholder:text-zinc-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                Manual risks
              </label>
              <textarea
                value={manualRisks}
                onChange={(e) => setManualRisks(e.target.value)}
                placeholder="One per line: title | low/medium/high | mitigation"
                className="min-h-[120px] w-full rounded-lg border border-zinc-600 bg-zinc-950 p-2 font-mono text-[11px] text-zinc-100 placeholder:text-zinc-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                Manual wins
              </label>
              <textarea
                value={manualWins}
                onChange={(e) => setManualWins(e.target.value)}
                placeholder="One win per line"
                className="min-h-[90px] w-full rounded-lg border border-zinc-600 bg-zinc-950 p-2 font-mono text-[11px] text-zinc-100 placeholder:text-zinc-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                Manual blockers
              </label>
              <textarea
                value={manualBlockers}
                onChange={(e) => setManualBlockers(e.target.value)}
                placeholder="One blocker per line"
                className="min-h-[90px] w-full rounded-lg border border-zinc-600 bg-zinc-950 p-2 font-mono text-[11px] text-zinc-100 placeholder:text-zinc-500"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/25 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Analyze
          </button>
          {error && <p className="mt-1 text-xs text-rose-300">{error}</p>}
        </div>

        <div className="space-y-3">
          {result?.summary && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-900/70 p-3">
              <p className="text-xs uppercase tracking-wider text-zinc-400">Summary</p>
              <p className="mt-1 text-sm text-zinc-100">{result.summary}</p>
            </div>
          )}

          <Section title="Action items" icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />}>
            {result?.action_items.length ? (
              <ul className="space-y-1.5">
                {result.action_items.map((a, i) => (
                  <li key={i} className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-sm text-zinc-100">
                    <span className="font-medium">{a.title}</span>
                    {(a.owner || a.due) && (
                      <span className="ml-2 font-mono text-[10px] text-emerald-200">
                        {a.owner ?? ""}
                        {a.owner && a.due ? " · " : ""}
                        {a.due ?? ""}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty />
            )}
          </Section>

          <Section title="Risks" icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-300" />}>
            {result?.risks.length ? (
              <ul className="space-y-1.5">
                {result.risks.map((r, i) => (
                  <li key={i} className={`rounded border px-2 py-1.5 text-sm ${SEVERITY[r.severity] ?? SEVERITY.medium}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{r.title}</span>
                      <span className="font-mono text-[10px] uppercase">{r.severity}</span>
                    </div>
                    {r.mitigation && <p className="mt-1 text-xs opacity-90">→ {r.mitigation}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty />
            )}
          </Section>

          <Section title="Wins" icon={<Trophy className="h-3.5 w-3.5 text-violet-300" />}>
            {result?.wins.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-100">
                {result.wins.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            ) : (
              <Empty />
            )}
          </Section>

          <Section title="Blockers" icon={<Zap className="h-3.5 w-3.5 text-rose-300" />}>
            {result?.blockers.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-100">
                {result.blockers.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            ) : (
              <Empty />
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-xs italic text-zinc-500">— nothing yet —</p>;
}
