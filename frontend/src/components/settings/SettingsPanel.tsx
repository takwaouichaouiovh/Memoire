"use client";

import { useState } from "react";
import { Check, Keyboard, RotateCcw } from "lucide-react";
import type { AppSettings } from "../../lib/workspace";
import { resetDemo } from "../../lib/api";
import { useToast } from "../ui/Toast";
import ConfirmModal from "../ui/ConfirmModal";

interface SettingsPanelProps {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
}

export default function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const toast = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setConfirmReset(false);
    setResetting(true);
    try {
      await resetDemo();
      toast.push("success", "Demo state cleared (backlog + chat history).");
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div>
        <h2 className="text-lg font-bold text-zinc-100">Settings</h2>
        <p className="text-xs text-zinc-400">Configure backend connectivity and assistant behavior for this session.</p>
      </div>

      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
        <header>
          <h3 className="text-sm font-semibold text-zinc-100">Backend</h3>
          <p className="text-xs text-zinc-400">URL used for chat, prioritization, and documents.</p>
        </header>
        <label className="block text-xs font-medium text-zinc-400">
          <span className="mb-1 block">API Base URL</span>
          <input
            type="url"
            value={settings.apiBaseUrl}
            onChange={(e) => update("apiBaseUrl", e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-violet-500"
            placeholder="http://localhost:8000"
          />
        </label>
        <p className="text-[11px] text-zinc-500">
          To persist changes across reloads, update <code className="text-zinc-300">NEXT_PUBLIC_API_URL</code>.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
        <header>
          <h3 className="text-sm font-semibold text-zinc-100">Assistant defaults</h3>
          <p className="text-xs text-zinc-400">Pick the default model and response language.</p>
        </header>
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-zinc-400">Default model</legend>
          {(["auto", "gpt-4o", "mistral-large"] as const).map((model) => {
            const isActive = settings.defaultModel === model;
            return (
              <button
                key={model}
                type="button"
                aria-pressed={isActive}
                onClick={() => update("defaultModel", model)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "border-violet-500/40 bg-violet-500/10 text-violet-100"
                    : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                <span>{model === "auto" ? "Auto (route by task)" : model}</span>
                {isActive && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-zinc-400">Response language</legend>
          <div className="flex gap-2">
            {(["auto", "en", "fr"] as const).map((lang) => {
              const isActive = settings.language === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => update("language", lang)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? "border-violet-500/40 bg-violet-500/10 text-violet-100"
                      : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              );
            })}
          </div>
        </fieldset>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
        <h3 className="text-sm font-semibold text-zinc-100">About POSTIE</h3>
        <p className="mt-1 text-xs text-zinc-400">
          POSTIE combines a RAG chatbot trained on Agile and PO knowledge with a multi-algorithm feature prioritization engine.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
        <header className="flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Keyboard shortcuts</h3>
        </header>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-zinc-300">
          {[
            ["g c", "Open Chat"],
            ["g p", "Open Prioritization"],
            ["g s", "Open Sprint Planner"],
            ["g r", "Open Retrospective"],
            ["g d", "Open Documents"],
            ["g ,", "Open Settings"],
          ].map(([key, label]) => (
            <li key={key} className="flex items-center justify-between gap-3">
              <span>{label}</span>
              <kbd className="rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                {key}
              </kbd>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
        <header>
          <h3 className="text-sm font-semibold text-rose-200">Demo controls</h3>
          <p className="text-xs text-rose-200/70">
            Wipe the backlog and chat history to start a fresh demo. Uploaded documents are kept.
          </p>
        </header>
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          disabled={resetting}
          className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-60"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {resetting ? "Resetting…" : "Reset demo state"}
        </button>
      </section>

      <ConfirmModal
        open={confirmReset}
        title="Reset demo state?"
        message="This clears the backlog and all chat sessions. Uploaded documents stay. This action cannot be undone."
        confirmLabel="Yes, reset"
        destructive
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
