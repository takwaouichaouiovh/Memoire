"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Brain,
  Calendar,
  Cloud,
  ListChecks,
  LogIn,
  LogOut,
  MessageSquare,
  Moon,
  RefreshCcw,
  Send,
  Sparkles,
  Sun,
  Wrench,
  Zap,
} from "lucide-react";
import { AuthUser, clearAccessToken, fetchHealth, fetchMe, getAccessToken } from "../lib/api";
import { useTheme } from "../hooks/useTheme";

const PRIMARY = "#7C3AED";

function initialsFromEmail(email: string): string {
  const handle = email.split("@")[0] ?? email;
  const parts = handle.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return handle.slice(0, 2).toUpperCase();
}

const FEATURE_CARDS = [
  {
    title: "Chat with your docs",
    icon: Zap,
    body: "Ask anything about Confluence pages, guidelines, or past decisions. Sources cited instantly.",
    tag: "RAG · GPT-4o · Mistral",
  },
  {
    title: "Prioritize your backlog",
    icon: ListChecks,
    body: "RICE v2, WSJF, ICE, Kano, Value/Effort, AI Blend, ML Hybrid — all normalized 0–100, all transparent.",
    tag: "7 algorithms",
  },
  {
    title: "Plan your sprint",
    icon: Calendar,
    body: "Knapsack 0/1 solver picks the optimal feature set for your sprint capacity in under 200ms.",
    tag: "Knapsack · O(n×C)",
  },
  {
    title: "Groom epics with AI",
    icon: Bot,
    body: "LangGraph agent splits your epic into INVEST-compliant stories with acceptance criteria and RICE scores.",
    tag: "LangGraph",
  },
  {
    title: "ReAct agent",
    icon: Wrench,
    body: "Tool-calling assistant that adds features, re-scores, and searches your docs in a single conversational turn.",
    tag: "Tool-calling",
  },
  {
    title: "Retrospective analyzer",
    icon: RefreshCcw,
    body: "Paste your retro notes — get structured forces, improvement areas, and action items instantly.",
    tag: "Structured output",
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
  "Quick Win": "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  "Big Bet": "bg-violet-500/15 text-violet-300 border-violet-500/40",
  "Fill-in": "bg-amber-500/15 text-amber-300 border-amber-500/40",
};

const STEPS = [
  { num: 1, label: "Upload your docs" },
  { num: 2, label: "Score your backlog" },
  { num: 3, label: "Plan your sprint" },
];

export default function HomePage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

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

  useEffect(() => {
    let mounted = true;
    const token = getAccessToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }
    fetchMe()
      .then((me) => {
        if (mounted) setUser(me);
      })
      .catch(() => {
        clearAccessToken();
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setAuthChecked(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = useCallback(() => {
    clearAccessToken();
    setUser(null);
  }, []);

  const goWorkspace = useCallback(() => {
    router.push(user ? "/workspace" : "/login");
  }, [router, user]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── TOPBAR ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md text-[11px] font-bold text-white shadow-sm"
              style={{ backgroundColor: PRIMARY }}
            >
              PO
            </div>
            <span className="text-sm font-semibold tracking-tight text-zinc-100">POSTIE</span>
            <span
              title={backendOnline === false ? "Backend offline" : "Backend online"}
              aria-label={backendOnline === false ? "Backend offline" : "Backend online"}
              className={`ml-1.5 h-1.5 w-1.5 rounded-full ${
                backendOnline === false ? "bg-rose-500" : "bg-emerald-400"
              }`}
            />
          </div>

          <nav className="hidden items-center gap-7 text-sm text-zinc-400 md:flex">
            <a href="#features" className="transition-colors hover:text-zinc-100">
              Features
            </a>
            <a href="#preview" className="transition-colors hover:text-zinc-100">
              Preview
            </a>
            <a href="#start" className="transition-colors hover:text-zinc-100">
              Get started
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Auth-aware right slot ───────────────────────────────── */}
            {!authChecked ? (
              <div
                aria-hidden
                className="h-8 w-24 animate-pulse rounded-md bg-zinc-800/60"
              />
            ) : user ? (
              <>
                <button
                  type="button"
                  onClick={() => router.push("/profile")}
                  className="hidden items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 sm:inline-flex"
                  title={user.email}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold text-white"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    {initialsFromEmail(user.email)}
                  </span>
                  <span className="max-w-[140px] truncate font-medium">{user.email}</span>
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/workspace")}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
                  style={{ backgroundColor: PRIMARY }}
                >
                  Open workspace
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Log out"
                  title="Log out"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-rose-300"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
                  style={{ backgroundColor: PRIMARY }}
                >
                  Get started
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,0.22),transparent_62%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent"
        />
        <div className="mx-auto max-w-3xl px-6 pb-20 pt-24 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
            <Sparkles className="h-3 w-3" />
            AI copilot for Product Owners
          </span>

          <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-zinc-100 sm:text-5xl md:text-6xl">
            Make better product decisions,{" "}
            <span style={{ color: PRIMARY }}>faster</span>.
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base text-zinc-400 sm:text-lg">
            Chat with your docs, prioritize your backlog with 7 algorithms, plan sprints and groom
            epics — all in one workspace.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={goWorkspace}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(124,58,237,0.6)] transition-opacity hover:opacity-95"
              style={{ backgroundColor: PRIMARY }}
            >
              {user ? "Open workspace" : "Get started free"}
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#preview"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
            >
              See it in action
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-xs text-zinc-500">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              <span className="font-medium text-zinc-300">7 algorithms</span>
            </div>
            <span className="hidden h-3 w-px bg-zinc-700 sm:block" aria-hidden />
            <div className="flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5 text-violet-400" />
              <span className="font-medium text-zinc-300">GPT-4o + Mistral</span>
            </div>
            <span className="hidden h-3 w-px bg-zinc-700 sm:block" aria-hidden />
            <div className="flex items-center gap-1.5">
              <Cloud className="h-3.5 w-3.5 text-violet-400" />
              <span className="font-medium text-zinc-300">Cloud-ready</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURE CARDS ───────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-[1200px] px-6 pb-20">
        <div className="mx-auto mb-10 max-w-xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-100">Everything you need</h2>
          <p className="mt-2 text-sm text-zinc-400">
            From the first user story to the final sprint plan — one tool, no context switching.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="group rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 transition-all hover:-translate-y-0.5 hover:border-violet-500/40 hover:bg-zinc-900 hover:shadow-[0_10px_30px_-15px_rgba(124,58,237,0.4)]"
              >
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300">
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </div>
                <h3 className="text-base font-semibold text-zinc-100">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{card.body}</p>
                <div className="mt-4 inline-flex items-center font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  {card.tag}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── WORKSPACE PREVIEW ───────────────────────────────────────── */}
      <section id="preview" className="border-t border-zinc-800/80 bg-zinc-900/30">
        <div className="mx-auto max-w-[1200px] px-6 py-20">
          <div className="mx-auto mb-10 max-w-xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-100">
              The workspace, at a glance
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Chat and prioritization, side by side. No tabs to juggle.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-[0_30px_60px_-30px_rgba(124,58,237,0.35)]">
            <div className="flex items-center gap-1.5 border-b border-zinc-800 bg-zinc-900/60 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <span className="ml-3 font-mono text-[11px] text-zinc-500">postie.app/workspace</span>
            </div>

            <div className="grid grid-cols-1 gap-px bg-zinc-800 lg:grid-cols-2">
              {/* Chat panel */}
              <div className="bg-zinc-950">
                <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-zinc-400" />
                    <span className="text-sm font-semibold text-zinc-100">PO Assistant</span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
                    <Bot className="h-3 w-3" />
                    Agent
                  </span>
                </div>
                <div className="space-y-3 px-4 py-5">
                  <div className="max-w-[85%] rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm leading-relaxed text-zinc-200">
                    Hey! I&apos;m your PO assistant, powered by GPT-4o + Mistral. Ask me about
                    backlog management, user stories, or feature prioritization.
                  </div>
                  <div className="ml-auto max-w-[85%] rounded-lg border border-violet-500/30 bg-violet-500/15 px-3 py-2 text-sm leading-relaxed text-zinc-100">
                    What&apos;s the difference between RICE and WSJF?
                  </div>
                  <div className="max-w-[85%] rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm leading-relaxed text-zinc-200">
                    RICE measures volume of impact per effort. WSJF prioritizes by cost of delay —
                    useful when timing matters…
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t border-zinc-800/80 px-3 py-2.5">
                  <input
                    type="text"
                    disabled
                    placeholder="Ask anything…"
                    className="flex-1 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-300 placeholder:text-zinc-600"
                  />
                  <button
                    type="button"
                    aria-label="Send"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-white shadow-sm"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Prioritization panel */}
              <div className="bg-zinc-950">
                <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-zinc-400" />
                    <span className="text-sm font-semibold text-zinc-100">
                      Feature Prioritization
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                    RICE v2
                  </span>
                </div>
                <ul className="divide-y divide-zinc-800/80">
                  {PRIO_PREVIEW.map((row) => {
                    const isTop = row.rank <= 2;
                    return (
                      <li key={row.rank} className="flex items-center gap-3 px-4 py-3">
                        <div
                          className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-bold ${
                            isTop ? "text-white shadow-sm" : "bg-zinc-800 text-zinc-300"
                          }`}
                          style={isTop ? { backgroundColor: PRIMARY } : undefined}
                        >
                          {row.rank}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-zinc-100">
                              {row.name}
                            </span>
                            <span
                              className={`flex-none rounded border px-1.5 py-0.5 text-[10px] font-semibold ${QUADRANT_STYLES[row.quadrant]}`}
                            >
                              {row.quadrant}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
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
        </div>
      </section>

      {/* ── GET STARTED STEPPER ─────────────────────────────────────── */}
      <section id="start" className="border-t border-zinc-800/80">
        <div className="mx-auto max-w-[1200px] px-6 py-20">
          <div className="mx-auto mb-12 max-w-xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-100">
              Get started in 3 steps
            </h2>
            <p className="mt-2 text-sm text-zinc-400">Takes under 2 minutes.</p>
          </div>

          <ol className="relative grid grid-cols-1 gap-10 md:grid-cols-3">
            <div
              aria-hidden
              className="absolute left-[calc(16.67%+1.25rem)] right-[calc(16.67%+1.25rem)] top-5 hidden h-px bg-zinc-800 md:block"
            />
            {STEPS.map((step) => (
              <li key={step.num} className="relative flex flex-col items-center text-center">
                <div
                  className="relative z-10 flex h-10 w-10 flex-none items-center justify-center rounded-full text-sm font-bold text-white shadow-[0_6px_18px_-6px_rgba(124,58,237,0.7)]"
                  style={{ backgroundColor: PRIMARY }}
                >
                  {step.num}
                </div>
                <div className="mt-4 text-sm font-semibold text-zinc-100">{step.label}</div>
              </li>
            ))}
          </ol>

          <div className="mt-12 flex justify-center">
            <button
              type="button"
              onClick={goWorkspace}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(124,58,237,0.6)] transition-opacity hover:opacity-95"
              style={{ backgroundColor: PRIMARY }}
            >
              {user ? "Open workspace" : "Create your account"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800/80">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <div
              className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold text-white"
              style={{ backgroundColor: PRIMARY }}
            >
              PO
            </div>
            <span className="font-medium text-zinc-300">POSTIE</span>
            <span className="text-zinc-700">·</span>
            <span>AI copilot for Product Owners</span>
          </div>
          <div className="text-zinc-500">Aouichaoui Takwa · M2 MIAS Centrale Lille · 2026</div>
        </div>
      </footer>
    </main>
  );
}
