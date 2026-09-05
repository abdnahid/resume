"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Send } from "lucide-react";

/**
 * What BSTI has asked the applicant to correct, and the button that sends it
 * back (D81).
 *
 * **The points are the permission.** Everything BSTI marked is editable again
 * and nothing else is, so this list is not advice — it is the exact scope of
 * what can be changed. Saying which step each point lives on is what stops the
 * applicant hunting through four pages for the one field that is open.
 *
 * There is no notification channel yet: no mail is sent (client addresses are
 * often `@mobile.bsti.invalid` placeholders) and SMS is not enabled. So this
 * panel *is* the notice, and it is deliberately loud.
 */
export default function ShortfallNotice({
  applicationId,
  roundNo,
  raisedAt,
  raisedBy,
  note,
  items,
  canRespond,
}: {
  applicationId: number;
  roundNo: number;
  raisedAt: string;
  raisedBy: string;
  note: string | null;
  items: { id: number; label: string; comment: string; step: number }[];
  canRespond: boolean;
}) {
  const router = useRouter();
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/applications/${applicationId}/shortfall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not send it.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send it.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-medium text-foreground">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" strokeWidth={2} />
        BSTI has asked for corrections
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Round {roundNo}, from {raisedBy} on {raisedAt}. Only the points below are
        open for editing — the rest of your application stays as filed.
      </p>
      {note && <p className="mt-2 text-sm italic text-muted-foreground">“{note}”</p>}

      <ol className="mt-4 space-y-2">
        {items.map((i) => (
          <li key={i.id} className="rounded-xl border border-border bg-card p-3">
            <p className="text-sm font-medium text-foreground">
              {i.label}
              <a
                href={`?step=${i.step}`}
                className="ml-2 text-xs font-normal text-primary underline-offset-4 hover:underline"
              >
                go to step {i.step}
              </a>
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{i.comment}</p>
          </li>
        ))}
      </ol>

      {canRespond && (
        <div className="mt-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              What you changed <span className="font-normal normal-case">(optional)</span>
            </span>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={2}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </label>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <button
            type="button"
            onClick={send}
            disabled={busy}
            className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Send className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            Send back to BSTI
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            Make the corrections first — sending closes this round and the points
            lock again until BSTI asks for more.
          </p>
        </div>
      )}
    </section>
  );
}
