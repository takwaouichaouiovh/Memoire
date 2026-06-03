"use client";

import { useEffect, useState } from "react";
import ChatPanel from "../chat/ChatPanel";
import DocumentsPanel from "../documents/DocumentsPanel";
import PrioritizationPanel from "../priority/PrioritizationPanel";
import SprintPlannerPanel from "../priority/SprintPlannerPanel";
import RetroPanel from "../retro/RetroPanel";
import SettingsPanel from "../settings/SettingsPanel";
import SupervisorPanel from "../agents/SupervisorPanel";
import GitHubIntegrationPanel from "../integrations/GitHubIntegrationPanel";
import Sidebar from "./Sidebar";
import { fetchHealth } from "../../lib/api";
import { DEFAULT_SETTINGS, AppSettings, WorkspaceView } from "../../lib/workspace";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";

const VIEW_HEADERS: Record<WorkspaceView, { title: string; subtitle: string }> = {
  split: {
    title: "Workspace",
    subtitle: "Chat with your PO assistant and prioritize features side by side.",
  },
  chat: {
    title: "Chat",
    subtitle: "Conversational assistant with retrieval-augmented answers.",
  },
  prioritization: {
    title: "Prioritization",
    subtitle: "Score and rank features with RICE, WSJF, MoSCoW or AI Blend.",
  },
  sprint: {
    title: "Sprint Planner",
    subtitle: "Knapsack-optimized sprint composition from your prioritized backlog.",
  },
  retro: {
    title: "Retrospective",
    subtitle: "Paste meeting notes — get action items, risks, wins and blockers.",
  },
  supervisor: {
    title: "Supervisor",
    subtitle: "Multi-agent orchestrator: groom → prioritize → plan → summarize.",
  },
  integrations: {
    title: "Integrations",
    subtitle: "Import a real backlog from GitHub Issues, or push features back.",
  },
  documents: {
    title: "Documents",
    subtitle: "Manage the knowledge base used by the assistant.",
  },
  settings: {
    title: "Settings",
    subtitle: "Configure backend connectivity and assistant defaults.",
  },
};

export default function WorkspaceShell({ initialView = "split" }: { initialView?: WorkspaceView } = {}) {
  const [view, setView] = useState<WorkspaceView>(initialView);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useKeyboardShortcuts(setView);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        await fetchHealth();
        if (mounted) setBackendOnline(true);
      } catch {
        if (mounted) setBackendOnline(false);
      }
    };
    check();
    const id = setInterval(check, 15000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const header = VIEW_HEADERS[view];

  return (
    <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-5 xl:grid-cols-[280px_1fr]">
      <Sidebar active={view} onSelect={setView} backendOnline={backendOnline} />

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/55 p-4 md:p-5">
        <header className="mb-4 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">{header.title}</h2>
            <p className="text-xs text-zinc-400">{header.subtitle}</p>
          </div>
          {view !== "settings" && (
            <button
              type="button"
              onClick={() => setView("settings")}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
            >
              Open Settings
            </button>
          )}
        </header>

        {view === "split" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <article className="h-[78vh] min-h-[520px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80">
              <ChatPanel />
            </article>
            <article className="h-[78vh] min-h-[520px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80">
              <PrioritizationPanel />
            </article>
          </div>
        )}

        {view === "chat" && (
          <article className="h-[82vh] min-h-[560px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80">
            <ChatPanel />
          </article>
        )}

        {view === "prioritization" && (
          <article className="h-[82vh] min-h-[560px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80">
            <PrioritizationPanel />
          </article>
        )}

        {view === "documents" && (
          <article className="h-[82vh] min-h-[560px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80">
            <DocumentsPanel />
          </article>
        )}

        {view === "sprint" && (
          <article className="h-[82vh] min-h-[560px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80">
            <SprintPlannerPanel />
          </article>
        )}

        {view === "retro" && (
          <article className="h-[82vh] min-h-[560px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80">
            <RetroPanel />
          </article>
        )}

        {view === "supervisor" && (
          <article className="h-[82vh] min-h-[560px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80">
            <SupervisorPanel />
          </article>
        )}

        {view === "integrations" && (
          <article className="h-[82vh] min-h-[560px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80">
            <GitHubIntegrationPanel />
          </article>
        )}

        {view === "settings" && (
          <article className="h-[82vh] min-h-[560px] overflow-auto rounded-2xl border border-zinc-800 bg-zinc-900/80">
            <SettingsPanel settings={settings} onChange={setSettings} />
          </article>
        )}
      </section>
    </div>
  );
}
