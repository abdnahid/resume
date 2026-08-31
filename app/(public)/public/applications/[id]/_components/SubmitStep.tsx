"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, CreditCard, Check } from "lucide-react";
import { formatPoisha, splitFee } from "@/lib/payments/money";
import { APPLICATION_FEE_POISHA } from "@/lib/cm/policy";
import type { Gap } from "@/lib/cm/policy";

/**
 * The fee-and-submit step.
 *
 * Submission is not a button of its own: the file is submitted the moment the
 * fee settles, because a paid fee against an unsubmitted application is money
 * held for nothing. The applicant pays; the payment return page submits.
 */
export default function SubmitStep({
  applicationId,
  gaps,
  feeStatus,
  feeReference,
}: {
  applicationId: number;
  gaps: Gap[];
  feeStatus: string | null;
  feeReference: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fee = splitFee(APPLICATION_FEE_POISHA);
  const ready = gaps.length === 0;

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/applications/${applicationId}/fee`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not raise the fee.");
      window.location.href = data.redirectUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not raise the fee.");
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 className="font-semibold text-foreground">Submit</h2>

      {!ready ? (
        <>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Finish these before paying the fee. Nothing is lost — the draft is saved as you go.
          </p>
          <ul className="mt-5 space-y-1.5 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
            {gaps.map((g) => (
              <li key={g.field} className="flex items-start gap-2 text-sm text-foreground">
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                  strokeWidth={2}
                />
                {g.label}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Everything is in place. Your application is submitted to BSTI as soon as the fee is
            paid.
          </p>
          <dl className="mt-5 space-y-2 rounded-xl border border-border p-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Application fee</dt>
              <dd className="text-foreground">{formatPoisha(fee.incomePoisha)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">VAT ({fee.vatRateBp / 100}%)</dt>
              <dd className="text-foreground">{formatPoisha(fee.vatPoisha)}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2 font-semibold">
              <dt className="text-foreground">Total</dt>
              <dd className="text-foreground">{formatPoisha(fee.totalPoisha)}</dd>
            </div>
          </dl>

          {feeStatus && feeStatus !== "paid" && feeReference && (
            <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
              A fee was already raised as{" "}
              <span className="font-mono">{feeReference}</span> and is{" "}
              <strong className="font-medium text-foreground">{feeStatus}</strong>. Paying again
              continues that same demand rather than creating a second one.
            </p>
          )}

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

          <button
            type="button"
            onClick={pay}
            disabled={busy}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            ) : (
              <CreditCard className="h-4 w-4" strokeWidth={2} />
            )}
            {busy ? "Opening the gateway…" : `Pay ${formatPoisha(fee.totalPoisha)} and submit`}
          </button>
        </>
      )}
    </section>
  );
}
