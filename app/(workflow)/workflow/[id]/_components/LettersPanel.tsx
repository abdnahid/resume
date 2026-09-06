"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Mail, Send } from "lucide-react";

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
 */
export default function LettersPanel({
  applicationId,
  planned,
  issued,
  blockedBy,
  canIssue,
}: {
  applicationId: number;
  planned: { kind: string; labName: string | null; to: string | null }[];
  issued: { id: number; kind: string; letterNo: string; labName: string | null; to: string | null; at: string }[];
  blockedBy: string[];
  canIssue: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = (k: string) =>
    k === "wing_head" ? "Testing wing" : k === "applicant" ? "Applicant" : "One Stop counter";

  if (issued.length > 0) {
    return (
      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-medium text-foreground">
          <Mail className="h-4 w-4 text-primary" strokeWidth={2} />
          Letters issued ({issued.length})
        </h2>
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
                body: JSON.stringify({ action: "issue-letters" }),
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
