"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, LogOut } from "lucide-react";
import { AuthUser, changePassword, clearAccessToken, fetchMe, getAccessToken } from "../../lib/api";

function initials(email: string | undefined): string {
  if (!email) return "··";
  const local = email.split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase() || "··";
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  po: "Product Owner",
  viewer: "Viewer",
};

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    fetchMe()
      .then(setMe)
      .catch(() => router.replace("/login"));
  }, [router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (newPwd !== confirmPwd) {
      setMessage({ kind: "err", text: "New password and confirmation do not match." });
      return;
    }
    setLoading(true);
    try {
      await changePassword(currentPwd, newPwd);
      setMessage({ kind: "ok", text: "Password updated successfully." });
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (err) {
      const text = err instanceof Error ? err.message.replace("API error:", "").trim() : "Update failed";
      setMessage({ kind: "err", text });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <button
          type="button"
          onClick={() => router.push("/workspace")}
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to workspace
        </button>

        {/* Identity card */}
        <section className="flex items-center gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5">
          <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-indigo-600/30 text-base font-bold text-violet-200 ring-1 ring-inset ring-violet-500/30">
            {initials(me?.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-zinc-100">
              {me?.email ?? "Loading…"}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {me ? ROLE_LABEL[me.role] ?? me.role : "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              clearAccessToken();
              router.replace("/login");
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </section>

        {/* Change password */}
        <section className="mt-5 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-100">Change password</h2>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Use at least 8 characters with one letter and one digit.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="current" className="block text-xs font-medium text-zinc-400">
                Current password
              </label>
              <input
                id="current"
                type="password"
                required
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-violet-500 focus:bg-zinc-900"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="new" className="block text-xs font-medium text-zinc-400">
                New password
              </label>
              <input
                id="new"
                type="password"
                required
                minLength={8}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-violet-500 focus:bg-zinc-900"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm" className="block text-xs font-medium text-zinc-400">
                Confirm new password
              </label>
              <input
                id="confirm"
                type="password"
                required
                minLength={8}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-violet-500 focus:bg-zinc-900"
              />
            </div>

            {message && (
              <p
                className={`rounded-md border px-3 py-2 text-xs ${
                  message.kind === "ok"
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                    : "border-rose-500/30 bg-rose-500/5 text-rose-300"
                }`}
              >
                {message.text}
              </p>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Saving…" : "Update password"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
