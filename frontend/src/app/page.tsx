"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Brain,
  Calendar,
  Cloud,
  FileText,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Moon,
  RefreshCcw,
  Send,
  Settings,
  Sparkles,
  Sun,
  Upload,
  Wrench,
  Zap,
} from "lucide-react";
import { fetchHealth } from "../lib/api";
import { useTheme } from "../hooks/useTheme";

const PRIMARY = "#3F4AB4";

const NAV_ITEMS = [
  { label: "Workspace", icon: LayoutDashboard, active: true },
  { label: "Chat", icon: MessageSquare, active: false },
  { label: "Prioritization", icon: ListChecks, active: false },
  { label: "Sprint Planner", icon: Calendar, active: false },
  { label: "Retrospective", icon: RefreshCcw, active: false },
  { label: "Documents", icon: FileText, active: false },
];

const FEATURE_CARDS = [
  {
    title: "Chat with your docs",
    icon: Zap,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    body: "Ask anything about Confluence pages, guidelines, or past decisions. Sources cited instantly.",
    tag: "RAG · GPT-4o · Mistral",
  },
  {
    title: "Prioritize your backlog",
    icon: ListChecks,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    body: "7 algorithms — RICE v2, WSJF, ICE, Kano, Value/Effort, AI Blend, ML Hybrid — all normalized 0–100, all transparent.",
    tag: "7 algorithms",
  },
  {
    title: "Plan your sprint",
    icon: Calendar,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    body: "Knapsack 0/1 solver picks the optimal feature set for your sprint capacity in under 200ms.",
    tag: "Knapsack · O(n×C)",
  },
  {
    title: "Groom epics with AI",
    icon: Bot,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    body: "LangGraph agent splits your epic into INVEST-compliant stories with acceptance criteria and RICE scores.",
    tag: "LangGraph · self-correction",
  },
  {
    title: "ReAct agent",
    icon: Wrench,
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
    body: "Tool-calling assistant that adds features, re-scores, and searches your docs in a single conversational turn.",
    tag: "ReAct · max 5 iterations",
  },
  {
    title: "Retrospective analyzer",
    icon: RefreshCcw,
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
    body: "Paste your retro notes — get structured forces, improvement areas, and action items instantly.",
    tag: "One-shot · structured output",
  },
];

const PRIO_PREVIEW = [
  { rank: 1, name: "Multilingual pages", quadrant: "Quick Win", score: 91 },
  { rank: 2, name: "Feedback thumbs", quadrant: "Quick Win", score: 76 },
  { rank: 3, name: "RAG confidence", quadrant: "Fill-in", score: 54 },
  { rank: 4, name: "Weaviate migration", quadrant: "Big Bet", score: 33 },
  { rank: 5, name: "Jira connector", quadrant: "Big Bet", score: 22 },
];

const QUADRANT_STYLES: Record<string, string> = {
  "Quick Win": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Big Bet": "bg-purple-50 text-purple-700 border-purple-200",
  "Fill-in": "bg-amber-50 text-amber-700 border-amber-200",
};

const STEPS = [
  { num: 1, label: "Upload your docs", done: true },
  { num: 2, label: "Add your features to the backlog", done: false },
  { num: 3, label: "Run prioritization", done: false },
  { num: 4, label: "Plan your sprint", done: false },
];

export default function HomePage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

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

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* ── TOPBAR ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: PRIMARY }}
          >
            PO
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-wide text-gray-900">POSTIE</div>
            <div className="text-[11px] text-gray-500">Product Owner Studio · AI-powered</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              backendOnline === false
                ? "bg-rose-50 text-rose-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                backendOnline === false ? "bg-rose-500" : "bg-emerald-500"
              }`}
            />
            {backendOnline === false ? "Backend offline" : "Backend online"}
          </span>
          <button
            type="button"
            onClick={toggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => router.push("/workspace")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Settings className="h-3.5 w-3.5" />
            Open Settings
          </button>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 px-6 pb-16 pt-12 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            OVHcloud Edition
          </span>
          <h1 className="mt-5 text-5xl font-bold leading-tight tracking-tight text-gray-900">
            Your <span style={{ color: PRIMARY }}>AI</span> copilot for product decisions
          </h1>
          <p className="mt-5 max-w-xl text-base text-gray-600">
            Chat with your docs, prioritize your backlog with 7 algorithms, plan sprints, and groom
            epics — all in one place.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/workspace")}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
              style={{ backgroundColor: PRIMARY }}
            >
              <LayoutDashboard className="h-4 w-4" />
              Open workspace
            </button>
            <button
              type="button"
              onClick={() => router.push("/documents")}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" />
              Upload your first doc
            </button>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-gray-400" />
              <span className="font-medium text-gray-700">7 algorithms</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5 text-gray-400" />
              <span className="font-medium text-gray-700">GPT-4o + Mistral</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Cloud className="h-3.5 w-3.5 text-gray-400" />
              <span className="font-medium text-gray-700">OVH-ready</span>
            </div>
          </div>
        </div>

        {/* Right — mini app preview */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white"
              style={{ backgroundColor: PRIMARY }}
            >
              PO
            </div>
            <div className="text-sm font-semibold text-gray-900">POSTIE</div>
          </div>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm ${
                    item.active ? "bg-[#EEF2FF] font-semibold" : "text-gray-600"
                  }`}
                  style={item.active ? { color: PRIMARY } : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </div>
              );
            })}
          </nav>
          <div className="mt-4 flex items-center gap-1.5 border-t border-gray-200 pt-3 text-[11px] text-gray-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Backend online · GPT-4o ready
          </div>
        </div>
      </section>

      {/* ── FEATURE CARDS ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1280px] px-6 pb-16">
        <h2 className="mb-6 text-xl font-bold text-gray-900">What you can do</h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div
                  className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${card.iconBg}`}
                >
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <h3 className="text-base font-semibold text-gray-900">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{card.body}</p>
                <div className="mt-4 inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600">
                  {card.tag}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── WORKSPACE PREVIEW ───────────────────────────────────────── */}
      <section className="mx-auto max-w-[1280px] px-6 pb-16">
        <h2 className="mb-6 text-xl font-bold text-gray-900">Workspace preview</h2>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Chat panel */}
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-semibold text-gray-900">PO Assistant</span>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600"
                >
                  <Bot className="h-3 w-3" />
                  Agent
                </button>
              </div>
              <div className="space-y-3 px-4 py-4">
                <div className="max-w-[85%] rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800">
                  Hey! I&apos;m your PO assistant, powered by GPT-4o + Mistral. Ask me about
                  backlog management, user stories, or feature prioritization.
                </div>
                <div className="ml-auto max-w-[85%] rounded-lg bg-[#EEF2FF] px-3 py-2 text-sm text-gray-900">
                  What&apos;s the difference between RICE and WSJF?
                </div>
                <div className="max-w-[85%] rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800">
                  RICE measures volume of impact per effort. WSJF prioritizes by cost of delay —
                  useful when timing matters…
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-gray-200 px-3 py-2.5">
                <input
                  type="text"
                  disabled
                  placeholder="Ask about backlog, user stories…"
                  className="flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 placeholder:text-gray-400"
                />
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-white"
                  style={{ backgroundColor: PRIMARY }}
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Prioritization panel */}
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-semibold text-gray-900">Feature Prioritization</span>
                </div>
                <div className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700">
                  RICE v2
                  <ArrowRight className="h-3 w-3 rotate-90 text-gray-400" />
                </div>
              </div>
              <ul className="divide-y divide-gray-100">
                {PRIO_PREVIEW.map((row) => {
                  const isTop = row.rank <= 2;
                  return (
                    <li key={row.rank} className="flex items-center gap-3 px-4 py-3">
                      <div
                        className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-bold ${
                          isTop ? "text-white" : "bg-gray-100 text-gray-600"
                        }`}
                        style={isTop ? { backgroundColor: PRIMARY } : undefined}
                      >
                        {row.rank}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-gray-900">
                            {row.name}
                          </span>
                          <span
                            className={`flex-none rounded border px-1.5 py-0.5 text-[10px] font-semibold ${QUADRANT_STYLES[row.quadrant]}`}
                          >
                            {row.quadrant}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${row.score}%`, backgroundColor: PRIMARY }}
                          />
                        </div>
                      </div>
                      <div
                        className="flex-none font-mono text-base font-bold tabular-nums"
                        style={{ color: PRIMARY }}
                      >
                        {row.score}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── GET STARTED STEPPER ─────────────────────────────────────── */}
      <section className="border-y border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-[1280px] px-6 py-10">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900">Get started in 3 steps</h2>
            <p className="text-sm text-gray-500">Takes under 2 minutes</p>
          </div>
          <ol className="relative grid grid-cols-1 gap-6 md:grid-cols-4">
            <div
              aria-hidden
              className="absolute left-0 right-0 top-4 hidden h-px bg-gray-200 md:block"
            />
            {STEPS.map((step) => (
              <li
                key={step.num}
                className="relative flex items-start gap-3 md:flex-col md:items-start"
              >
                <div
                  className={`relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-bold ${
                    step.done ? "text-white" : "border border-gray-300 bg-white text-gray-600"
                  }`}
                  style={step.done ? { backgroundColor: PRIMARY } : undefined}
                >
                  {step.num}
                </div>
                <div className="text-sm font-medium text-gray-800 md:mt-2">{step.label}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="px-6 py-8 text-center text-[12px] text-gray-500">
        POSTIE — Copilot IA pour Product Owners · Aouichaoui Takwa · M2 MIAS Centrale Lille ·
        OVHcloud · 2026
      </footer>
    </main>
  );
}
