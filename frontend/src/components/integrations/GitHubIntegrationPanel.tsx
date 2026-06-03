"use client";

import { useState } from "react";
import { Github, Loader2, Download, Upload, AlertTriangle, ExternalLink } from "lucide-react";
import {
  exportGitHub,
  importGitHub,
  GitHubExportResponse,
  GitHubImportResponse,
} from "../../lib/api";

export default function GitHubIntegrationPanel() {
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [state, setState] = useState<"open" | "closed" | "all">("open");
  const [mergeStrategy, setMergeStrategy] = useState<"upsert" | "append" | "replace">("upsert");
  const [apply, setApply] = useState(false);
  const [loading, setLoading] = useState<"import" | "export" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<GitHubImportResponse | null>(null);
  const [exportResult, setExportResult] = useState<GitHubExportResponse | null>(null);

  const handleImport = async () => {
    setLoading("import");
    setError(null);
    setImportResult(null);
    try {
      const r = await importGitHub({
        repo,
        token: token || undefined,
        state,
        label_filter: labelFilter || undefined,
        merge_strategy: mergeStrategy,
        limit: 200,
      });
      setImportResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(null);
    }
  };

  const handleExport = async () => {
    setLoading("export");
    setError(null);
    setExportResult(null);
    try {
      const r = await exportGitHub({
        repo,
        token: token || undefined,
        apply,
      });
      setExportResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-6 py-3">
        <Github className="h-4 w-4 text-violet-300" />
        <h3 className="text-sm font-semibold text-zinc-100">GitHub Issues</h3>
        <span className="font-mono text-[10px] text-zinc-500">
          import a real backlog · export features as issues
        </span>
      </div>

      <div className="space-y-4 border-b border-zinc-800 px-6 py-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Repository (owner/name)
            <input
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="vercel/next.js"
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Token (optional, or set <code>GITHUB_TOKEN</code> on the backend)
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_…"
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            State
            <select
              value={state}
              onChange={(e) => setState(e.target.value as typeof state)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
            >
              <option value="open">open</option>
              <option value="closed">closed</option>
              <option value="all">all</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Label filter
            <input
              type="text"
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
              placeholder="bug"
              className="w-36 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Merge strategy
            <select
              value={mergeStrategy}
              onChange={(e) => setMergeStrategy(e.target.value as typeof mergeStrategy)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
            >
              <option value="upsert">upsert (refresh existing)</option>
              <option value="append">append (only new)</option>
              <option value="replace">replace (wipe backlog)</option>
            </select>
          </label>
          <button
            type="button"
            disabled={!repo || loading !== null}
            onClick={handleImport}
            className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-40"
          >
            {loading === "import" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            Import issues → backlog
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={apply}
              onChange={(e) => setApply(e.target.checked)}
            />
            <span>
              Apply (push features back as real issues) — otherwise dry-run preview only
            </span>
          </label>
          <button
            type="button"
            disabled={!repo || loading !== null}
            onClick={handleExport}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
              apply
                ? "border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
                : "border-violet-500/40 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25"
            }`}
          >
            {loading === "export" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            {apply ? "Apply export" : "Dry-run export"}
          </button>
        </div>
        {error && (
          <p className="flex items-center gap-1 text-xs text-rose-400">
            <AlertTriangle className="h-3 w-3" /> {error}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {importResult && (
          <section className="mb-6">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Import result — {importResult.repo}
            </h4>
            <p className="text-xs text-zinc-300">
              Fetched <strong>{importResult.fetched}</strong>, created{" "}
              <strong>{importResult.created}</strong>, updated{" "}
              <strong>{importResult.updated}</strong>, skipped{" "}
              <strong>{importResult.skipped}</strong>.
            </p>
            <ul className="mt-2 space-y-1 text-[11px]">
              {importResult.features.slice(0, 50).map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-950 px-2 py-1"
                >
                  <span className="font-mono text-zinc-500">#{f.external_id}</span>
                  <span className="flex-1 truncate text-zinc-200">{f.name}</span>
                  {f.epic && <span className="text-violet-300">{f.epic}</span>}
                  {f.external_url && (
                    <a
                      href={f.external_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-500 hover:text-zinc-300"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {exportResult && (
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
              Export {exportResult.apply ? "applied" : "preview (dry-run)"} — {exportResult.total} item(s)
            </h4>
            {exportResult.warnings.length > 0 && (
              <ul className="mb-2 space-y-0.5 text-[11px] text-amber-300">
                {exportResult.warnings.map((w, i) => (
                  <li key={i}>⚠ {w}</li>
                ))}
              </ul>
            )}
            <ul className="space-y-1 text-[11px]">
              {exportResult.previews.slice(0, 50).map((p) => (
                <li
                  key={p.feature_id}
                  className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-[10px] ${
                        p.action === "create"
                          ? "text-emerald-300"
                          : p.action === "update"
                          ? "text-amber-300"
                          : "text-zinc-500"
                      }`}
                    >
                      {p.action.toUpperCase()}
                    </span>
                    {p.existing_issue && (
                      <span className="text-zinc-500">#{p.existing_issue}</span>
                    )}
                    <span className="flex-1 truncate text-zinc-200">{p.title}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {p.labels.map((l) => (
                      <span
                        key={l}
                        className="rounded bg-zinc-800 px-1 py-0.5 text-[9px] text-zinc-400"
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
