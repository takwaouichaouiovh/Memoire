"use client";

import {
  Bot,
  CalendarClock,
  ClipboardList,
  FileText,
  Github,
  ListChecks,
  LogOut,
  MessageSquareText,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthUser, clearAccessToken, fetchMe } from "../../lib/api";
import type { WorkspaceView } from "../../lib/workspace";
import { useTheme } from "../../hooks/useTheme";

interface SidebarProps {
  active: WorkspaceView;
  onSelect: (view: WorkspaceView) => void;
  backendOnline: boolean | null;
}

const NAV: { key: WorkspaceView; label: string; icon: LucideIcon }[] = [
  { key: "chat", label: "Chat", icon: MessageSquareText },
  { key: "prioritization", label: "Prioritization", icon: ListChecks },
  { key: "sprint", label: "Sprint Planner", icon: CalendarClock },
  { key: "supervisor", label: "Supervisor", icon: Bot },
  { key: "retro", label: "Retrospective", icon: ClipboardList },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "integrations", label: "Integrations", icon: Github },
];

function initials(email: string | undefined): string {
  if (!email) return "··";
  const local = email.split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase() || "··";
}

export default function Sidebar({ active, onSelect, backendOnline }: SidebarProps) {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [me, setMe] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetchMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const statusLabel =
    backendOnline === null ? "Checking" : backendOnline ? "Online" : "Offline";
  const statusDot =
    backendOnline === null
      ? "bg-zinc-500"
      : backendOnline
      ? "bg-emerald-400"
      : "bg-rose-500";

  return (
    <aside className="sticky top-5 flex h-[calc(100vh-2.5rem)] w-full flex-col rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3">
      {/* Brand */}
      <Link
        href="/"
        aria-label="Go to POSTIE landing page"
        className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 text-[11px] font-bold text-white">
          PO
        </div>
        <span className="text-sm font-semibold tracking-tight text-zinc-100">
          POSTIE
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] font-medium text-zinc-500">
          <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} aria-hidden />
          {statusLabel}
        </span>
      </Link>

      {/* Navigation */}
      <nav aria-label="Primary" className="mt-5 flex-1 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelect(item.key)}
              className={`group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                isActive
                  ? "bg-zinc-800/70 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
              }`}
            >
              <Icon
                className={`h-4 w-4 flex-none ${
                  isActive ? "text-violet-300" : "text-zinc-500 group-hover:text-zinc-300"
                }`}
              />
              <span className="flex-1 font-medium">{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          aria-current={active === "settings" ? "page" : undefined}
          onClick={() => onSelect("settings")}
          className={`group mt-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
            active === "settings"
              ? "bg-zinc-800/70 text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
          }`}
        >
          <Settings
            className={`h-4 w-4 flex-none ${
              active === "settings"
                ? "text-violet-300"
                : "text-zinc-500 group-hover:text-zinc-300"
            }`}
          />
          <span className="flex-1 font-medium">Settings</span>
        </button>
      </nav>

      {/* Footer: theme toggle + user */}
      <div className="mt-3 space-y-2 border-t border-zinc-800/70 pt-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800/40 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          <span className="flex-1 text-left">
            {theme === "dark" ? "Light theme" : "Dark theme"}
          </span>
        </button>

        <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-indigo-600/30 text-[10px] font-bold text-violet-200 ring-1 ring-inset ring-violet-500/30 transition-colors hover:from-violet-500/50 hover:to-indigo-600/50"
            title="Open profile"
          >
            {initials(me?.email)}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-zinc-200">
              {me?.email ?? "—"}
            </p>
            <p className="truncate text-[10px] uppercase tracking-wider text-zinc-500">
              {me?.role ?? "loading"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              clearAccessToken();
              router.replace("/login");
            }}
            className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
