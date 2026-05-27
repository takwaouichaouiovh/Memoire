"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Loader2, MessageSquarePlus, Send, Sparkles, Wrench } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sendChatMessage, Source } from "../../hooks/useChat";
import { chatAssistant, clearChatSession, fetchSession, AssistantToolCall } from "../../lib/api";
import ChatHistorySidebar from "./ChatHistorySidebar";

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  sources?: Source[];
  toolCalls?: AssistantToolCall[];
  loading?: boolean;
}

const INTRO_MESSAGE: Message = {
  id: "intro",
  role: "assistant",
  content:
    "Hey 👋 I'm your PO assistant, powered by GPT-4o + Mistral. Ask me anything about backlog management, user stories, Scrum, SAFe, or feature prioritization.",
  model: "GPT-4o",
  sources: [],
};

const PROMPT_SUGGESTIONS = [
  "Write acceptance criteria for a payment feature",
  "Compare RICE and WSJF with an example",
  "Draft 3 user stories for an onboarding flow",
];

// ── Sub-components ────────────────────────────────────────────────────────────

function SourceChips({ sources }: { sources: Source[] }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {sources.map((s, i) => (
        <span
          key={`${s.name}-${i}`}
          title={s.snippet ?? s.name}
          className="rounded border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 font-mono text-[10px] text-violet-300"
        >
          {s.name}
          {s.page ? ` p.${s.page}` : ""}
        </span>
      ))}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse self-end" : "self-start"} max-w-[82%]`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
          isUser ? "bg-emerald-500/15 text-emerald-300" : "bg-violet-500/15 text-violet-300"
        }`}
      >
        {isUser ? "PO" : "AI"}
      </div>
      <div>
        <div
          className={`rounded-xl border px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "rounded-tr-sm border-violet-500/20 bg-violet-500/10 text-zinc-100"
              : "rounded-tl-sm border-zinc-700 bg-zinc-800 text-zinc-100"
          }`}
        >
          {msg.loading ? (
            <TypingIndicator />
          ) : isUser ? (
            <div className="whitespace-pre-wrap">{msg.content}</div>
          ) : (
            <div
              className="markdown-body space-y-2
                [&_p]:my-1 [&_p]:leading-relaxed
                [&_strong]:font-semibold [&_strong]:text-white
                [&_em]:italic
                [&_h1]:mt-3 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-white
                [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-white
                [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-white
                [&_ul]:my-1 [&_ul]:ml-4 [&_ul]:list-disc [&_ul]:space-y-1
                [&_ol]:my-1 [&_ol]:ml-4 [&_ol]:list-decimal [&_ol]:space-y-1
                [&_li]:leading-relaxed
                [&_code]:rounded [&_code]:bg-zinc-900 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-amber-300
                [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-zinc-700 [&_pre]:bg-zinc-900 [&_pre]:p-3
                [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-zinc-200
                [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-violet-500/50 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-zinc-300
                [&_a]:text-violet-300 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-violet-200
                [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs
                [&_th]:border [&_th]:border-zinc-700 [&_th]:bg-zinc-900 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold
                [&_td]:border [&_td]:border-zinc-700 [&_td]:px-2 [&_td]:py-1
                [&_hr]:my-3 [&_hr]:border-zinc-700"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1">
            {msg.toolCalls.map((tc, i) => (
              <details key={i} className="rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-200">
                <summary className="flex cursor-pointer items-center gap-1">
                  <Wrench className="h-3 w-3" />
                  <span className="font-mono">{tc.name}</span>
                  <span className="text-amber-300/70">({Object.keys(tc.args).length} args)</span>
                </summary>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-[10px] text-amber-100/80">
                  args: {JSON.stringify(tc.args, null, 2)}
                  {"\n"}result: {JSON.stringify(tc.result, null, 2).slice(0, 600)}
                </pre>
              </details>
            ))}
          </div>
        )}
        {msg.sources && <SourceChips sources={msg.sources} />}
        {msg.model && <p className="mt-1 font-mono text-[10px] text-zinc-500">{msg.model}</p>}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([INTRO_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState("session-pending");
  const [agentMode, setAgentMode] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId(`session-${Date.now()}`);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const bumpHistory = useCallback(() => setHistoryRefresh((n) => n + 1), []);

  const handleSelectSession = useCallback(async (id: string) => {
    if (id === sessionId) return;
    try {
      const session = await fetchSession(id);
      const restored: Message[] = session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        model: m.model,
        sources: m.sources,
        toolCalls: m.tool_calls,
      }));
      setMessages(restored.length ? restored : [INTRO_MESSAGE]);
      setSessionId(id);
      setAgentMode(session.mode === "agent");
      setInput("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load session";
      setMessages([
        INTRO_MESSAGE,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `⚠️ ${msg}`,
          model: "error",
        },
      ]);
    }
  }, [sessionId]);

  const handleDeletedSession = useCallback((id: string) => {
    if (id === sessionId) {
      setSessionId(`session-${Date.now()}`);
      setMessages([INTRO_MESSAGE]);
    }
  }, [sessionId]);

  const handleSend = async (override?: string) => {
    const msg = (override ?? input).trim();
    if (!msg || loading) return;
    if (!override) setInput("");

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: msg };
    const loadingMsg: Message = { id: "loading", role: "assistant", content: "", loading: true };
    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setLoading(true);

    try {
      if (agentMode) {
        const data = await chatAssistant(msg, sessionId);
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== "loading")
            .concat({
              id: crypto.randomUUID(),
              role: "assistant",
              content: data.answer || "(no response)",
              model: `Agent · ${data.iterations} iter`,
              toolCalls: data.tool_calls,
            })
        );
      } else {
        const data = await sendChatMessage(msg, sessionId);
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== "loading")
            .concat({
              id: crypto.randomUUID(),
              role: "assistant",
              content: data.answer,
              model: data.model_used,
              sources: data.sources,
            })
        );
      }
    } catch (error) {
      const apiMessage = error instanceof Error ? error.message : "Unknown error";
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== "loading")
          .concat({
            id: crypto.randomUUID(),
            role: "assistant",
            content: `⚠️ ${apiMessage}`,
            model: "error",
          })
      );
    } finally {
      setLoading(false);
      bumpHistory();
    }
  };

  const handleNewChat = async () => {
    try {
      await clearChatSession(sessionId);
    } catch {
      // ignore — best-effort cleanup
    }
    setSessionId(`session-${Date.now()}`);
    setMessages([INTRO_MESSAGE]);
    setInput("");
    bumpHistory();
  };

  const showSuggestions = messages.length <= 1 && !loading;

  return (
    <div className="flex h-full">
      <ChatHistorySidebar
        currentSessionId={sessionId}
        refreshSignal={historyRefresh}
        onSelect={handleSelectSession}
        onDeleted={handleDeletedSession}
      />
      <div className="flex h-full flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">PO Assistant</h3>
          <p className="font-mono text-[10px] text-zinc-500">Session {sessionId.slice(-6)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAgentMode((v) => !v)}
            title="Toggle tool-calling agent mode"
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
              agentMode
                ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            {agentMode ? "Agent ON" : "Agent"}
          </button>
          <button
            type="button"
            onClick={handleNewChat}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            New chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-6">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {showSuggestions && (
          <div className="mt-2 flex flex-wrap gap-2">
            {PROMPT_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleSend(suggestion)}
                className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-violet-500/40 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 px-6 pb-5 pt-3">
        <label htmlFor="chat-input" className="sr-only">
          Send a message to the PO assistant
        </label>
        <div className="flex items-end gap-3 rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 transition-colors focus-within:border-violet-500">
          <Sparkles className="mb-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
          <textarea
            id="chat-input"
            aria-label="Message"
            className="max-h-28 min-h-[20px] flex-1 resize-none bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
            placeholder="Ask about backlog, user stories, SAFe, sprint planning… (Shift+Enter for newline)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-30"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
            ) : (
              <Send className="h-3.5 w-3.5 text-white" />
            )}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
