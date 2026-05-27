"use client";

import { useEffect } from "react";
import type { WorkspaceView } from "../lib/workspace";

/**
 * Vim-style "g <letter>" shortcuts to jump between workspace views.
 *  - g c  → chat
 *  - g p  → prioritization
 *  - g s  → sprint
 *  - g r  → retro
 *  - g d  → documents
 *  - g ,  → settings
 */
export function useKeyboardShortcuts(onSelect: (view: WorkspaceView) => void) {
  useEffect(() => {
    let armed = false;
    let timer: number | null = null;

    const disarm = () => {
      armed = false;
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs.
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (!armed && e.key.toLowerCase() === "g") {
        armed = true;
        timer = window.setTimeout(disarm, 1200);
        return;
      }

      if (!armed) return;

      const map: Record<string, WorkspaceView> = {
        c: "chat",
        p: "prioritization",
        s: "sprint",
        r: "retro",
        d: "documents",
        ",": "settings",
      };
      const target = map[e.key.toLowerCase()];
      if (target) {
        e.preventDefault();
        onSelect(target);
      }
      disarm();
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      disarm();
    };
  }, [onSelect]);
}
