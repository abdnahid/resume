"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, SquarePen } from "lucide-react";

/**
 * The reviewing officer's two moves: ask for corrections, or declare the file
 * ready for processing (D81).
 *
 * **Marking a point is what reopens it.** The comment is not advice attached to
 * a note — the target it hangs on is the edit permission the applicant gets, so
 * the form makes you tick the part of the application you mean. A covering note
 * alone would leave the applicant unable to act on it.
 *
 * Only rendered for whoever is holding the file. The service re-checks that, so
 * this is a convenience rather than the rule.
 */

export type Target = { target: string; label: string; hint: string; step: number };

export default function ReviewPanel({
  applicationId,
  targets,
  openRound,
}: {
  applicationId: number;
  targets: Target[];
  /** The round awaiting a reply, if any — while one is open there is nothing to do. */
  openRound: { roundNo: number; raisedAt: string; itemCount: number } | null;
}) {
  const router = useRouter();
  const [marked, setMarked] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"shortfall" | "ready" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = Object.entries(marked)
    .filter(([, comment]) => comment.trim().length > 0)
    .map(([target, comment]) => ({ target, comment }));

  async function send(action: "shortfall" | "ready") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/workflow/applications/${applicationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "shortfall" ? { action, note, items } : { action },
        ),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "That did not work.");
      setMarked({});
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  if (openRound) {
    return (
      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <h2 className="font-display text-lg font-medium text-foreground">
          Round {openRound.roundNo} is with the applicant
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {openRound.itemCount} {openRound.itemCount === 1 ? "point" : "points"} sent on{" "}
          {openRound.raisedAt}. Those parts of the application are open for them to
          correct; nothing else is. You will see it here again when they respond.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-medium text-foreground">Review</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tick what is wrong and say why. Only the points you mark reopen for the
        applicant — anything you leave alone stays as filed.
      </p>

      <ul className="mt-4 space-y-2">
        {targets.map((t) => {
          const on = t.target in marked;
          return (
            <li key={t.target} className="rounded-xl border border-border p-3">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) =>
                    setMarked((m) => {
                      const next = { ...m };
                      if (e.target.checked) next[t.target] = "";
                      else delete next[t.target];
                      return next;
                    })
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{t.label}</span>
                  {t.hint && (
                    <span className="block text-xs text-muted-foreground">{t.hint}</span>
                  )}
                </span>
              </label>
              {on && (
                <textarea
                  value={marked[t.target]}
                  onChange={(e) =>
                    setMarked((m) => ({ ...m, [t.target]: e.target.value }))
                  }
                  rows={2}
                  placeholder="What is wrong with it, and what should they do?"
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
                />
              )}
            </li>
          );
        })}
      </ul>

      <label className="mt-4 block">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Covering note <span className="font-normal normal-case">(optional)</span>
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        />
      </label>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => send("shortfall")}
          disabled={busy !== null || items.length === 0}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "shortfall" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <SquarePen className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          Request corrections
          {items.length > 0 && ` (${items.length})`}
        </button>

        <button
          type="button"
          onClick={() => send("ready")}
          disabled={busy !== null}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
        >
          {busy === "ready" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          Ready for processing
        </button>
      </div>
    </section>
  );
}
