"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationItem,
} from "../../lib/api";

function formatRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "now";
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

function kindDot(kind: NotificationItem["kind"]): string {
  if (kind === "success") return "bg-emerald-400";
  if (kind === "warning") return "bg-amber-400";
  if (kind === "error") return "bg-rose-500";
  return "bg-sky-400";
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const unreadLabel = useMemo(() => (unread > 99 ? "99+" : String(unread)), [unread]);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await fetchNotifications(40);
      setItems(data.items);
      setUnread(data.unread_count);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
    const id = setInterval(() => {
      refresh().catch(() => undefined);
    }, 20000);
    return () => clearInterval(id);
  }, []);

  const onMarkRead = async (id: string) => {
    await markNotificationRead(id);
    await refresh();
  };

  const onDelete = async (id: string) => {
    await deleteNotification(id);
    await refresh();
  };

  const onReadAll = async () => {
    await markAllNotificationsRead();
    await refresh();
  };

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[16px] rounded-full bg-rose-500 px-1 py-px text-[9px] font-bold leading-none text-white ring-2 ring-zinc-950">
            {unreadLabel}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-10 z-40 w-[360px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        >
          <header className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-zinc-100">Notifications</p>
              <p className="text-[11px] text-zinc-500">
                {unread > 0 ? `${unread} unread` : "All caught up"}
              </p>
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={onReadAll}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </header>

          <div className="max-h-[420px] overflow-auto py-1">
            {loading && items.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-zinc-500">Loading…</p>
            )}
            {!loading && items.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-zinc-500">
                You don&apos;t have any notifications yet.
              </p>
            )}
            {items.map((item) => (
              <article
                key={item.id}
                className={`group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-900 ${
                  item.read ? "" : "bg-zinc-900/40"
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${kindDot(item.kind)} ${
                    item.read ? "opacity-30" : ""
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-xs ${
                      item.read ? "font-medium text-zinc-300" : "font-semibold text-zinc-100"
                    }`}
                  >
                    {item.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-zinc-400">
                    {item.message}
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-600">{formatRelative(item.created_at)}</p>
                </div>
                <div className="flex flex-none items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  {!item.read && (
                    <button
                      type="button"
                      onClick={() => onMarkRead(item.id)}
                      className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                      title="Mark as read"
                      aria-label="Mark as read"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-rose-300"
                    title="Delete"
                    aria-label="Delete notification"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
