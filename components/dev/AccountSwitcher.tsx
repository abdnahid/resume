"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * **Development only.** A floating "become this person" control, so a workflow
 * can be walked end to end without signing out and in at every desk.
 *
 * It renders nothing outside development — `process.env.NODE_ENV` is inlined at
 * build time, so the whole component is eliminated from a production bundle
 * rather than merely hidden. The route behind it 404s there in any case; the
 * two gates are deliberately independent, because this is the one control in
 * the system whose failure mode is an authentication bypass.
 *
 * Nothing here knows a password. It asks the server to sign in, and the server
 * uses the ordinary credential path.
 */
type Account = {
  employeeId: string;
  name: string;
  designation: string | null;
  office: string | null;
  grade: string | null;
  role: string;
  status: string | null;
  hasDesk: boolean;
  /** How many applications sit on this desk right now. */
  holding: number;
};

export default function AccountSwitcher() {
  if (process.env.NODE_ENV === "production") return null;
  return <Switcher />;
}

function Switcher() {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    if (!open || accounts) return;
    fetch("/api/dev/switch")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("unavailable"))))
      .then((j: { accounts: Account[] }) => setAccounts(j.accounts))
      .catch(() => setError("Could not load the account list."));
  }, [open, accounts]);

  // Who we are now, so the list can mark it. Best-effort: the switcher is a
  // convenience and must never be what breaks a page.
  useEffect(() => {
    if (!open) return;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setMe(j?.employeeId ?? j?.employee?.id ?? null))
      .catch(() => {});
  }, [open]);

  const shown = useMemo(() => {
    if (!accounts) return [];
    const needle = q.trim().toLowerCase();
    const hit = needle
      ? accounts.filter((a) =>
          [a.name, a.employeeId, a.designation, a.office, a.role]
            .filter(Boolean)
            .some((s) => String(s).toLowerCase().includes(needle)),
        )
      : accounts;
    return hit.slice(0, 60);
  }, [accounts, q]);

  async function become(employeeId: string) {
    setBusy(employeeId);
    setError(null);
    try {
      const res = await fetch("/api/dev/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "That sign-in was refused.");
      }
      setOpen(false);
      // A full reload, not router.refresh(): the session cookie changed, and
      // every server component on the page was rendered for the old one.
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That sign-in was refused.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] print:hidden">
      {open && (
        <div className="mb-2 flex max-h-[70vh] w-[26rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-amber-400/60 bg-white shadow-2xl dark:bg-neutral-900">
          <div className="flex items-center gap-2 border-b border-amber-400/40 bg-amber-50 px-3 py-2 dark:bg-amber-950/40">
            <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              dev
            </span>
            <span className="text-xs font-semibold">Switch account</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              Close
            </button>
          </div>

          <div className="border-b border-neutral-200 p-2 dark:border-neutral-800">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, employee ID, designation, office, role…"
              className="w-full rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-amber-500 dark:border-neutral-700"
            />
          </div>

          {error && (
            <p className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {!accounts && !error && (
              <p className="px-3 py-4 text-xs text-neutral-500">Loading…</p>
            )}
            {accounts && shown.length === 0 && (
              <p className="px-3 py-4 text-xs text-neutral-500">Nobody matches that.</p>
            )}
            {shown.map((a) => {
              const isMe = me !== null && a.employeeId === me;
              return (
                <button
                  key={a.employeeId}
                  type="button"
                  disabled={busy !== null || isMe}
                  onClick={() => become(a.employeeId)}
                  className={`flex w-full items-start gap-2 border-b border-neutral-100 px-3 py-2 text-left last:border-0 disabled:opacity-60 dark:border-neutral-800 ${
                    isMe ? "bg-neutral-50 dark:bg-neutral-800/50" : "hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {a.name}
                      {isMe && <span className="ml-2 text-[10px] text-neutral-500">you</span>}
                    </span>
                    <span className="block truncate text-[11px] text-neutral-500">
                      {a.employeeId}
                      {a.designation ? ` · ${a.designation}` : ""}
                      {a.grade ? ` · g${a.grade}` : ""}
                    </span>
                    <span className="block truncate text-[11px] text-neutral-500">
                      {a.office ?? "no office"}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {a.holding > 0 && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {a.holding} file{a.holding === 1 ? "" : "s"}
                      </span>
                    )}
                    {a.role !== "employee" && (
                      <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] dark:bg-neutral-700">
                        {a.role}
                      </span>
                    )}
                    {!a.hasDesk && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400">no desk</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="border-t border-neutral-200 px-3 py-1.5 text-[10px] text-neutral-500 dark:border-neutral-800">
            Signs in with the shared test password. Development builds only.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Development account switcher"
        className="flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-500 px-3 py-2 text-xs font-semibold text-white shadow-lg hover:bg-amber-600"
      >
        <span className="rounded bg-white/25 px-1 text-[10px] font-bold uppercase">dev</span>
        Switch account
      </button>
    </div>
  );
}
