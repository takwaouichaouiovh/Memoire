"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Download, FileText, Loader2, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import {
  PrioritizationBacklogFeature,
  SprintPlan,
  DependencySprintPlan,
  fetchPrioritizationBacklog,
  planSprint,
  planSprintWithDependencies,
} from "../../lib/api";

const ALGOS = [
  { key: "rice", label: "RICE" },
  { key: "wsjf", label: "WSJF" },
  { key: "ice", label: "ICE" },
  { key: "kano", label: "Kano" },
  { key: "value_effort", label: "Value/Effort" },
  { key: "ml_hybrid", label: "ML Hybrid" },
] as const;

export default function SprintPlannerPanel() {
  const [backlog, setBacklog] = useState<PrioritizationBacklogFeature[]>([]);
  const [velocity, setVelocity] = useState<number>(() => {
    if (typeof window === "undefined") return 20;
    const saved = window.localStorage.getItem("postie:sprint:velocity");
    return saved ? Number(saved) || 20 : 20;
  });
  const [algorithm, setAlgorithm] = useState<string>(() => {
    if (typeof window === "undefined") return "rice";
    return window.localStorage.getItem("postie:sprint:algo") || "rice";
  });
  const [plan, setPlan] = useState<SprintPlan | DependencySprintPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useDeps, setUseDeps] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("postie:sprint:deps") === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("postie:sprint:deps", useDeps ? "1" : "0");
  }, [useDeps]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("postie:sprint:velocity", String(velocity));
  }, [velocity]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("postie:sprint:algo", algorithm);
  }, [algorithm]);

  const loadBacklog = useCallback(async () => {
    try {
      const items = await fetchPrioritizationBacklog();
      setBacklog(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load backlog");
    }
  }, []);

  useEffect(() => {
    loadBacklog();
  }, [loadBacklog]);

  const handlePlan = async () => {
    if (!backlog.length) {
      setError("Backlog is empty — add features first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = useDeps
        ? await planSprintWithDependencies(backlog, velocity, algorithm, "auto")
        : await planSprint(backlog, velocity, algorithm);
      setPlan(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sprint planning failed");
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = (filename: string, content: string, mime: string) => {
    // Include UTF-8 BOM so Excel opens accents correctly.
    const blob = new Blob(["\uFEFF", content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const csvEscape = (value: string | number | undefined | null): string => {
    if (value === undefined || value === null) return "";
    const str = String(value).replace(/"/g, '""');
    return /[";\n\r]/.test(str) ? `"${str}"` : str;
  };

  const handleExportCsv = () => {
    if (!plan) return;

    const date = new Date().toISOString().slice(0, 10);
    const header = [
      "status",
      "rank",
      "id",
      "name",
      "epic",
      "moscow",
      "score",
      "effort",
      "description",
    ];

    const allRows = [
      ...plan.selected.map((item) => ({ status: "IN_SPRINT", item })),
      ...plan.deferred.map((item) => ({ status: "DEFERRED", item })),
    ];

    const rows = allRows.map(({ status, item }) =>
      [
        status,
        item.rank,
        item.feature.id,
        item.feature.name,
        item.feature.epic,
        item.feature.moscow,
        item.score.toFixed(2),
        item.effort,
        item.feature.description,
      ]
        .map(csvEscape)
        .join(";")
    );

    const meta = [
      `# Sprint plan - ${date}`,
      `# Algorithm: ${plan.algorithm} | Velocity: ${plan.velocity} | Utilization: ${plan.utilization}%`,
      `# Selected: ${plan.selected.length} | Deferred: ${plan.deferred.length} | Total value: ${plan.total_value.toFixed(1)}`,
      "",
    ].join("\n");

    const csv = meta + header.join(";") + "\n" + rows.join("\n");
    downloadFile(`sprint-plan-${plan.algorithm}-${date}.csv`, csv, "text/csv");
  };

  const handleExportMarkdown = () => {
    if (!plan) return;

    const date = new Date().toISOString().slice(0, 10);
    const lines: string[] = [];

    lines.push(`# Sprint Plan - ${date}`);
    lines.push("");
    lines.push(`- **Algorithm:** ${plan.algorithm}`);
    lines.push(`- **Velocity:** ${plan.velocity}`);
    lines.push(`- **Utilization:** ${plan.utilization}% (${plan.total_effort} / ${plan.velocity})`);
    lines.push(`- **Total value:** ${plan.total_value.toFixed(1)}`);
    lines.push(`- **Strategy:** ${plan.strategy}`);
    lines.push("");

    lines.push(`## Selected for sprint (${plan.selected.length})`);
    lines.push("");
    if (plan.selected.length) {
      lines.push("| Rank | Feature | Epic | MoSCoW | Score | Effort |");
      lines.push("|---|---|---|---|---|---|");
      for (const item of plan.selected) {
        lines.push(
          `| ${item.rank} | ${item.feature.name} | ${item.feature.epic || "-"} | ${item.feature.moscow} | ${item.score.toFixed(1)} | ${item.effort} |`
        );
      }
    } else {
      lines.push("(no items selected)");
    }

    lines.push("");
    lines.push(`## Deferred (${plan.deferred.length})`);
    lines.push("");
    if (plan.deferred.length) {
      lines.push("| Rank | Feature | Epic | MoSCoW | Score | Effort |");
      lines.push("|---|---|---|---|---|---|");
      for (const item of plan.deferred) {
        lines.push(
          `| ${item.rank} | ${item.feature.name} | ${item.feature.epic || "-"} | ${item.feature.moscow} | ${item.score.toFixed(1)} | ${item.effort} |`
        );
      }
    } else {
      lines.push("(everything fits in sprint)");
    }

    lines.push("");
    lines.push(`Generated by PO.ai on ${new Date().toLocaleString()}`);

    downloadFile(`sprint-plan-${plan.algorithm}-${date}.md`, lines.join("\n"), "text/markdown");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-violet-300" />
          <h3 className="text-sm font-semibold text-zinc-100">Sprint Planner</h3>
          <span className="font-mono text-[10px] text-zinc-500">
            {backlog.length} features in backlog
          </span>
        </div>
        <button
          type="button"
          onClick={loadBacklog}
          className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500"
        >
          <RefreshCw className="h-3 w-3" /> Reload
        </button>
      </div>

      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Velocity (effort budget)
            <input
              type="number"
              min={1}
              step={0.5}
              value={velocity}
              onChange={(e) => setVelocity(Number(e.target.value))}
              className="w-32 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
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
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handlePlan}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-500/25 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Plan sprint
          </button>
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={useDeps}
              onChange={(e) => setUseDeps(e.target.checked)}
            />
            Respect dependencies (ILP)
          </label>
        </div>
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      </div>

      {plan && (
        <div className="border-b border-zinc-800 px-6 py-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-300">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              Utilization: <strong>{plan.utilization}%</strong>
            </span>
            <span>
              Effort: <strong>{plan.total_effort}</strong> / {plan.velocity}
            </span>
            <span>
              Value: <strong>{plan.total_value.toFixed(1)}</strong>
            </span>
            <span className="font-mono text-[10px] text-zinc-500">
              strategy: {plan.strategy}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20"
                title="Export sprint plan as CSV"
              >
                <Download className="h-3 w-3" /> CSV
              </button>
              <button
                type="button"
                onClick={handleExportMarkdown}
                className="flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-200 transition-colors hover:bg-violet-500/20"
                title="Export sprint plan as Markdown"
              >
                <FileText className="h-3 w-3" /> Markdown
              </button>
            </div>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-violet-500"
              style={{ width: `${Math.min(plan.utilization, 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto px-6 py-4 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
            Sprint ({plan?.selected.length ?? 0})
          </h4>
          <ul className="space-y-2">
            {(plan?.selected ?? []).map((item) => (
              <li
                key={item.feature.id}
                className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-100">{item.feature.name}</span>
                  <span className="font-mono text-[10px] text-emerald-300">
                    {item.score.toFixed(1)} · {item.effort}w
                  </span>
                </div>
                {item.feature.epic && (
                  <p className="mt-0.5 text-[10px] text-zinc-500">{item.feature.epic}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Deferred ({plan?.deferred.length ?? 0})
          </h4>
          <ul className="space-y-2">
            {(plan?.deferred ?? []).map((item) => (
              <li
                key={item.feature.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-zinc-300">{item.feature.name}</span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {item.score.toFixed(1)} · {item.effort}w
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
