"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Mail, Send, Zap } from "lucide-react";

/**
 * The letters that follow an approved visit (D95).
 *
 * **Derived, then issued.** Which letters are needed is worked out from the
 * sealed boxes — one to each laboratory's wing head, one to the applicant, one
 * to each One Stop counter — so the officer cannot forget a laboratory, for the
 * same reason he does not type the destinations (D69). But he issues them, in
 * his own name: approval says the visit is sound, and these letters describe his
 * samples.
 *
 * **All at once.** A partial dispatch means a laboratory expecting a box the
 * applicant was never told to carry.
 *
 * **And it is where urgent testing is decided** (D134). Not a separate control
 * somewhere earlier: this is the act that fixes the fee (D129), so it is the
 * last moment the choice can be made and the first at which it can be charged
 * for. The officer sees both figures before he chooses, because the surcharge
 * is the applicant's money and "urgent" with no price beside it is not a choice
 * anybody can make responsibly.
 */
export default function LettersPanel({
  applicationId,
  planned,
  issued,
  blockedBy,
  canIssue,
  fee,
  wasUrgent,
}: {
  applicationId: number;
  planned: { kind: string; labName: string | null; to: string | null }[];
  issued: { id: number; kind: string; letterNo: string; labName: string | null; to: string | null; at: string }[];
  blockedBy: string[];
  canIssue: boolean;
  /** Both totals and both turnarounds, so the choice is made with the price in view. */
  fee: {
    normalTaka: string;
    urgentTaka: string;
    normalDays: number | null;
    urgentDays: number | null;
    /** False when no test on this file can actually be hurried. */
    urgentAvailable: boolean;
  } | null;
  /** What was chosen, once the letters have gone. */
  wasUrgent: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urgent, setUrgent] = useState(false);

  const label = (k: string) =>
    k === "wing_head" ? "Testing wing" : k === "applicant" ? "Applicant" : "One Stop counter";

  if (issued.length > 0) {
    return (
      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-medium text-foreground">
          <Mail className="h-4 w-4 text-primary" strokeWidth={2} />
          Letters issued ({issued.length})
          {wasUrgent && (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-700 dark:text-rose-400">
              <Zap className="h-3 w-3" strokeWidth={2} />
              Urgent
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Testing was demanded on {wasUrgent ? "an urgent" : "the normal"} basis
          and the fee charged at that rate. Changing it now means fresh letters
          with their own numbers.
        </p>
        <ul className="mt-3 space-y-2">
          {issued.map((l) => (
            <li key={l.id} className="rounded-xl border border-border bg-card p-3">
              <p className="text-sm font-medium text-foreground">
                {label(l.kind)}
                {l.labName && <span className="text-muted-foreground"> · {l.labName}</span>}
              </p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">{l.letterNo}</p>
              <p className="text-xs text-muted-foreground">
                {l.to ?? "—"} · {l.at}
              </p>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-medium text-foreground">
        <Mail className="h-4 w-4 text-primary" strokeWidth={2} />
        Letters to issue
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Worked out from the sealed boxes, so no laboratory can be missed. They go
        out together in your name — a partial dispatch means a laboratory
        expecting a box the applicant was never told to carry.
      </p>

      <ul className="mt-4 space-y-1.5">
        {planned.map((p, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-2 text-sm">
            <span className="w-36 shrink-0 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {label(p.kind)}
            </span>
            <span className={p.to ? "text-foreground" : "text-destructive"}>
              {p.to ?? "nobody to address"}
              {p.labName && <span className="text-muted-foreground"> · {p.labName}</span>}
            </span>
          </li>
        ))}
      </ul>

      {blockedBy.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-xl bg-amber-500/5 p-3 text-xs text-muted-foreground">
          {blockedBy.map((b) => (
            <li key={b} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2} />
              {b}
            </li>
          ))}
        </ul>
      )}
      {canIssue && fee && (
        <div className="mt-4 rounded-xl border border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Testing basis
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Demanded with these letters and snapshotted, so it cannot be changed
            afterwards without issuing fresh ones.
          </p>
          <div className="mt-3 space-y-2">
            <Basis
              checked={!urgent}
              onSelect={() => setUrgent(false)}
              label="Normal"
              amount={fee.normalTaka}
              days={fee.normalDays}
            />
            <Basis
              checked={urgent}
              onSelect={() => setUrgent(true)}
              label="Urgent"
              amount={fee.urgentTaka}
              days={fee.urgentDays}
              disabled={!fee.urgentAvailable}
              note={
                fee.urgentAvailable
                  ? undefined
                  : "No test on this file has a shorter urgent turnaround, so there is nothing to buy."
              }
            />
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {canIssue && (
        <button
          type="button"
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const res = await fetch(`/api/workflow/applications/${applicationId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "issue-letters", urgent }),
              });
              if (!res.ok) throw new Error((await res.json()).error ?? "That did not work.");
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "That did not work.");
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy || blockedBy.length > 0}
          title={blockedBy.length > 0 ? "Everything has to be addressable first." : undefined}
          className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <Send className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          Issue all {planned.length} letters
        </button>
      )}
    </section>
  );
}

/**
 * One of the two bases, with what it costs and how long it takes.
 *
 * A radio and not a checkbox: "normal" is a choice the officer makes, not the
 * absence of one, and an unticked box reads as a question nobody answered on
 * the act that fixes an applicant's fee.
 */
function Basis({
  checked,
  onSelect,
  label,
  amount,
  days,
  disabled,
  note,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  amount: string;
  days: number | null;
  disabled?: boolean;
  note?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-baseline gap-2.5 rounded-lg border p-2.5 text-sm transition-colors ${
        disabled
          ? "cursor-not-allowed border-border opacity-50"
          : checked
            ? "border-primary/50 bg-primary/5"
            : "border-border hover:border-primary/30"
      }`}
    >
      <input
        type="radio"
        name="testing-basis"
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="mt-1 accent-[var(--primary)]"
      />
      <span className="min-w-0 flex-1">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {" · "}
          {amount}
          {days !== null && ` · ${days} working day${days === 1 ? "" : "s"}`}
        </span>
        {note && <span className="mt-0.5 block text-xs text-muted-foreground">{note}</span>}
      </span>
    </label>
  );
}
