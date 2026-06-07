"use client";

import { useEffect, useRef, useState } from "react";
import { Check, History, Loader2, MessageSquare, Pencil, Trash2, X } from "lucide-react";
import {
  SessionSummary,
  deleteSession,
  fetchSessions,
  renameSession,
} from "../../lib/api";

interface Props {
  currentSessionId: string;
  refreshSignal: number; // bump to force a reload of the list
  onSelect: (sessionId: string) => void;
  onDeleted: (sessionId: string) => void;
}

const MIN_WIDTH = 180;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 256;
const STORAGE_KEY = "poai.chatHistory.width";

function formatRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ChatHistorySidebar({
  currentSessionId,
  refreshSignal,
  onSelect,
  onDeleted,
}: Props) {
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const [resizing, setResizing] = useState(false);
  const resizingRef = useRef(false);

  // Load persisted width on mount
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!Number.isNaN(parsed)) {
        setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parsed)));
      }
    }
  }, []);

  // Global mouse listeners while dragging
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setWidth(next);
    };
    const onUp = () => {
      resizingRef.current = false;
      setResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        window.localStorage.setItem(STORAGE_KEY, String(width));
      } catch {
        // ignore quota errors
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing, width]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    setResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setSessions(await fetchSessions());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [refreshSignal]);

  const handleRename = async (id: string) => {
    const newTitle = editValue.trim();
    if (!newTitle) {
      setEditingId(null);
      return;
    }
    try {
      await renameSession(id, newTitle);
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed");
    } finally {
      setEditingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this conversation? This cannot be undone.")) return;
    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      onDeleted(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-950/30"
      style={{ width: `${width}px` }}
    >
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          <History className="h-3.5 w-3.5" />
          History
        </div>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-600" />}
      </div>

      {error && (
        <p className="px-4 py-2 text-[11px] text-rose-400">{error}</p>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {sessions.length === 0 && !loading && (
          <p className="px-2 py-6 text-center text-[11px] text-zinc-600">
            No conversations yet.
          </p>
        )}

        <ul className="space-y-0.5">
          {sessions.map((s) => {
            const isActive = s.id === currentSessionId;
            const isEditing = editingId === s.id;
            return (
              <li
                key={s.id}
                className={`group relative rounded-md px-2.5 py-2 text-xs transition-colors ${
                  isActive
                    ? "bg-zinc-800/70 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
                }`}
              >
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleRename(s.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[12px] text-zinc-100 outline-none focus:border-violet-500"
                    />
                    <button
                      type="button"
                      onClick={() => void handleRename(s.id)}
                      className="rounded p-1 text-emerald-400 hover:bg-emerald-500/10"
                      aria-label="Save"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-800"
                      aria-label="Cancel"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    className="block w-full text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      <MessageSquare
                        className={`h-3 w-3 shrink-0 ${
                          isActive ? "text-violet-300" : "text-zinc-600"
                        }`}
                      />
                      <span
                        className={`truncate font-medium ${
                          isActive ? "text-zinc-100" : "text-zinc-200"
                        }`}
                      >
                        {s.title}
                      </span>
                      {s.mode === "agent" && (
                        <span className="ml-auto rounded bg-amber-500/15 px-1 text-[9px] font-bold uppercase text-amber-300">
                          AG
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-[10px] text-zinc-600">
                      <span>{s.message_count} msgs</span>
                      <span>{formatRelative(s.updated_at)}</span>
                    </div>
                  </button>
                )}

                {!isEditing && (
                  <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(s.id);
                        setEditValue(s.title);
                      }}
                      className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                      aria-label="Rename"
                      title="Rename"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(s.id);
                      }}
                      className="rounded p-1 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-300"
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Resize handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize history panel"
        onMouseDown={startResize}
        onDoubleClick={() => {
          setWidth(DEFAULT_WIDTH);
          try {
            window.localStorage.setItem(STORAGE_KEY, String(DEFAULT_WIDTH));
          } catch {
            // ignore
          }
        }}
        title="Drag to resize · double-click to reset"
        className={`absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize transition-colors ${
          resizing ? "bg-violet-500/60" : "bg-transparent hover:bg-violet-500/30"
        }`}
      />
    </aside>
  );
}
