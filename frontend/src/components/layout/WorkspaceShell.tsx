"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChatPanel from "../chat/ChatPanel";
import DocumentsPanel from "../documents/DocumentsPanel";
import PrioritizationPanel from "../priority/PrioritizationPanel";
import SprintPlannerPanel from "../priority/SprintPlannerPanel";
import RetroPanel from "../retro/RetroPanel";
import SettingsPanel from "../settings/SettingsPanel";
import SupervisorPanel from "../agents/SupervisorPanel";
import GitHubIntegrationPanel from "../integrations/GitHubIntegrationPanel";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";
import { fetchHealth, getAccessToken } from "../../lib/api";
import { DEFAULT_SETTINGS, AppSettings, WorkspaceView } from "../../lib/workspace";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";

const VIEW_HEADERS: Record<WorkspaceView, { title: string; subtitle: string }> = {
  split: {
    title: "Workspace",
    subtitle: "Assistant and prioritization, side by side.",
  },
  chat: {
    title: "Chat",
    subtitle: "Retrieval-augmented PO assistant.",
  },
  prioritization: {
    title: "Prioritization",
    subtitle: "Rank features with RICE, WSJF, MoSCoW or AI Blend.",
  },
  sprint: {
    title: "Sprint Planner",
    subtitle: "Knapsack-optimized sprint composition.",
  },
  retro: {
    title: "Retrospective",
    subtitle: "Turn meeting notes into actions, risks, wins, blockers.",
  },
  supervisor: {
    title: "Supervisor",
    subtitle: "Groom, prioritize, plan, summarize in one run.",
  },
  integrations: {
    title: "Integrations",
    subtitle: "GitHub Issues import and export.",
  },
  documents: {
    title: "Documents",
    subtitle: "Knowledge base used by the assistant.",
  },
  settings: {
    title: "Settings",
    subtitle: "Backend connectivity and assistant defaults.",
  },
};

export default function WorkspaceShell({ initialView = "split" }: { initialView?: WorkspaceView } = {}) {
  const router = useRouter();
  const [view, setView] = useState<WorkspaceView>(initialView);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [authorized, setAuthorized] = useState<boolean>(false);

  useKeyboardShortcuts(setView);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setAuthorized(true);
  }, [router]);

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

  if (!authorized) {
    return null;
  }

  return (
    <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 xl:grid-cols-[260px_1fr]">
      <Sidebar active={view} onSelect={setView} backendOnline={backendOnline} />

      <section className="flex min-w-0 flex-col gap-4">
        <header className="flex items-center justify-between px-1">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight text-zinc-100">
              {header.title}
            </h2>
            <p className="mt-0.5 truncate text-xs text-zinc-500">{header.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>

        {view === "split" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <article className="h-[78vh] min-h-[520px] overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/60">
              <ChatPanel />
            </article>
            <article className="h-[78vh] min-h-[520px] overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/60">
              <PrioritizationPanel />
            </article>
          </div>
        )}

        {view === "chat" && (
          <article className="h-[82vh] min-h-[560px] overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/60">
            <ChatPanel />
          </article>
        )}

        {view === "prioritization" && (
          <article className="h-[82vh] min-h-[560px] overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/60">
            <PrioritizationPanel />
          </article>
        )}

        {view === "documents" && (
          <article className="h-[82vh] min-h-[560px] overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/60">
            <DocumentsPanel />
          </article>
        )}

        {view === "sprint" && (
          <article className="h-[82vh] min-h-[560px] overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/60">
            <SprintPlannerPanel />
          </article>
        )}

        {view === "retro" && (
          <article className="h-[82vh] min-h-[560px] overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/60">
            <RetroPanel />
          </article>
        )}

        {view === "supervisor" && (
          <article className="h-[82vh] min-h-[560px] overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/60">
            <SupervisorPanel />
          </article>
        )}

        {view === "integrations" && (
          <article className="h-[82vh] min-h-[560px] overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/60">
            <GitHubIntegrationPanel />
          </article>
        )}

        {view === "settings" && (
          <article className="h-[82vh] min-h-[560px] overflow-auto rounded-xl border border-zinc-800/80 bg-zinc-900/60">
            <SettingsPanel settings={settings} onChange={setSettings} />
          </article>
        )}
      </section>
    </div>
  );
}
