"use client";

import {
  Bot,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  FileText,
  Github,
  Home,
  ListChecks,
  MessageSquareText,
  Moon,
  Settings,
  Sun,
  UserCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { WorkspaceView } from "../../lib/workspace";
import { useTheme } from "../../hooks/useTheme";

interface SidebarProps {
  active: WorkspaceView;
  onSelect: (view: WorkspaceView) => void;
  backendOnline: boolean | null;
}

const NAV: { key: WorkspaceView; label: string; icon: LucideIcon; hint?: string }[] = [
  { key: "chat", label: "Chat", icon: MessageSquareText, hint: "Ask the assistant" },
  { key: "prioritization", label: "Prioritization", icon: ListChecks, hint: "Score the backlog" },
  { key: "sprint", label: "Sprint Planner", icon: CalendarClock, hint: "Knapsack capacity" },
  { key: "supervisor", label: "Supervisor", icon: Bot, hint: "Multi-agent orchestrator" },
  { key: "retro", label: "Retrospective", icon: ClipboardList, hint: "Analyze sprint notes" },
  { key: "documents", label: "Documents", icon: FileText, hint: "Knowledge base" },
  { key: "integrations", label: "Integrations", icon: Github, hint: "GitHub import/export" },
];

export default function Sidebar({ active, onSelect, backendOnline }: SidebarProps) {
  const { theme, toggle } = useTheme();

  return (
    <aside className="sticky top-4 flex h-[calc(100vh-2rem)] w-full flex-col rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 md:p-4">
      {/* Brand / home link */}
      <Link
        href="/"
        aria-label="Go to POSTIE landing page"
        title="Back to home"
        className="group relative flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-3 transition-colors hover:border-violet-500/50 hover:bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white shadow-sm">
          PO
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            <Home className="h-2.5 w-2.5" />
            Home
          </div>
          <p className="truncate text-base font-black leading-tight tracking-tight text-zinc-100">
            POSTIE
          </p>
        </div>
        <ChevronRight className="h-3.5 w-3.5 flex-none text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-300" />
      </Link>

      <p className="mt-2 px-1 text-[10px] uppercase tracking-[0.18em] text-zinc-600">
        Product Owner Studio
      </p>

      {/* Primary navigation */}
      <nav aria-label="Primary" className="mt-4 flex-1 space-y-1 overflow-y-auto">
        <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
          Workspace
        </p>
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelect(item.key)}
              title={item.hint}
              className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                isActive
                  ? "bg-violet-500/15 text-violet-100"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
              }`}
            >
              <span
                aria-hidden
                className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-violet-400 transition-opacity ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
              />
              <Icon
                className={`h-4 w-4 flex-none ${
                  isActive ? "text-violet-300" : "text-zinc-500 group-hover:text-zinc-300"
                }`}
              />
              <span className="flex-1 font-medium">{item.label}</span>
            </button>
          );
        })}

        <div className="my-3 h-px bg-zinc-800" />

        <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
          System
        </p>
        <button
          type="button"
          aria-current={active === "settings" ? "page" : undefined}
          onClick={() => onSelect("settings")}
          className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
            active === "settings"
              ? "bg-violet-500/15 text-violet-100"
              : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
          }`}
        >
          <span
            aria-hidden
            className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-violet-400 transition-opacity ${
              active === "settings" ? "opacity-100" : "opacity-0"
            }`}
          />
          <Settings
            className={`h-4 w-4 flex-none ${
              active === "settings" ? "text-violet-300" : "text-zinc-500 group-hover:text-zinc-300"
            }`}
          />
          <span className="flex-1 font-medium">Settings</span>
        </button>
      </nav>

      {/* Footer cluster */}
      <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <span className="flex items-center gap-2">
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {theme === "dark" ? "Light theme" : "Dark theme"}
          </span>
          <span className="rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-zinc-500">
            {theme}
          </span>
        </button>

        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5">
          <span className="relative flex h-2 w-2">
            {backendOnline && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            )}
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                backendOnline === null
                  ? "bg-zinc-500"
                  : backendOnline
                  ? "bg-emerald-400"
                  : "bg-rose-500"
              }`}
              aria-hidden
            />
          </span>
          <p className="text-[11px] font-medium text-zinc-400">
            {backendOnline === null
              ? "Checking..."
              : backendOnline
              ? "Backend online"
              : "Backend offline"}
          </p>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/80 px-2.5 py-2">
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-zinc-800">
            <UserCircle2 className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-zinc-100">PO Owner</p>
            <p className="truncate text-[10px] text-zinc-500">owner@postie.ai</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
