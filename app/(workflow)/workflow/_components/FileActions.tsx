"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Inbox, Loader2 } from "lucide-react";
import { groupByRank, type Desk } from "@/lib/workflow/chain";

/**
 * Receiving a file, and passing it on.
 *
 * The desk list is handed down already filtered by `eligibleDesks()`, but the
 * route re-checks it — the picker is a convenience, not the rule, and a form
 * post can name any employee id.
 */
export function ReceiveButton({ applicationId }: { applicationId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflow/applications/${applicationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "receive" }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not receive it.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not receive it.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <Inbox className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        Receive
      </button>
      {error && <p className="mt-1 max-w-xs text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function PassPanel({
  applicationId,
  down,
  up,
}: {
  applicationId: number;
  down: Desk[];
  up: Desk[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState<"down" | "up" | null>(null);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = open === "down" ? down : up;

  async function go() {
    if (!to) return setError("Choose a desk.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflow/applications/${applicationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pass", direction: open, toEmployeeId: to, note }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not pass it on.");
      setOpen(null);
      setTo("");
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not pass it on.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={down.length === 0}
          onClick={() => {
            setOpen(open === "down" ? null : "down");
            setTo("");
            setError(null);
          }}
          title={down.length === 0 ? "No more junior desk in this section" : undefined}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowDown className="h-3.5 w-3.5" strokeWidth={2} />
          Pass down
        </button>
        <button
          type="button"
          disabled={up.length === 0}
          onClick={() => {
            setOpen(open === "up" ? null : "up");
            setTo("");
            setError(null);
          }}
          title={up.length === 0 ? "No more senior desk in this section" : undefined}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowUp className="h-3.5 w-3.5" strokeWidth={2} />
          Send up
        </button>
      </div>

      {open && (
        <div className="mt-3 w-full max-w-md rounded-xl border border-border bg-card p-4 text-left">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {open === "down" ? "Pass down to" : "Send up to"}
          </label>
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          >
            <option value="">Choose a desk…</option>
            {/*
              Grouped by rank rather than listed flat: Assistant Director,
              Inspector, Examiner and Field Officer are all grade 9, so an
              ordered list runs 80-odd names together with nothing to read them
              by. The rank comes from the designation (`groupByRank`), in both
              languages, since the roster holds both.
            */}
            {groupByRank(list).map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.desks.map((d) => (
                  <option key={d.employeeId} value={d.employeeId}>
                    {d.name}
                    {d.grade ? ` — grade ${d.grade}` : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <label className="mb-1.5 mt-3 block text-xs font-medium text-muted-foreground">
            Note <span className="font-normal text-muted-foreground/70">(optional)</span>
          </label>
          <textarea
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What the next desk needs to know"
          />

          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={go}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />}
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
