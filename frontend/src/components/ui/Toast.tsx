"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type ToastKind = "success" | "error" | "info";
export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  push: (kind: ToastKind, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let _id = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((all) => all.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++_id;
      setToasts((all) => [...all, { id, kind, message }]);
      window.setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const Icon = toast.kind === "success" ? CheckCircle2 : toast.kind === "error" ? AlertTriangle : Info;
  const tone =
    toast.kind === "success"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : toast.kind === "error"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
      : "border-sky-500/40 bg-sky-500/10 text-sky-200";

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-2 rounded-lg border bg-zinc-900/95 px-3 py-2 text-sm shadow-lg backdrop-blur ${tone}`}
    >
      <Icon className="mt-0.5 h-4 w-4 flex-none" />
      <p className="flex-1">{toast.message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="-mr-1 -mt-1 rounded p-1 text-zinc-400 hover:text-zinc-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // No-op fallback for tests / pages that forget to wrap.
    return { push: () => {} };
  }
  return ctx;
}

/** Convenience hook that listens for `window` `postie:toast` events. */
export function useGlobalToastBridge() {
  const { push } = useToast();
  useEffect(() => {
    const handler = (evt: Event) => {
      const ce = evt as CustomEvent<{ kind: ToastKind; message: string }>;
      if (ce.detail) push(ce.detail.kind, ce.detail.message);
    };
    window.addEventListener("postie:toast", handler);
    return () => window.removeEventListener("postie:toast", handler);
  }, [push]);
}
