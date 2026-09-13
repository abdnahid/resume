"use client";

import { useState } from "react";
import { Banknote, Check, Loader2 } from "lucide-react";
import { formatPoisha } from "@/lib/payments/money";

/**
 * The testing fee (D129) — the second payment the spec describes.
 *
 * It appears only once the sampling letters are out, because that is the moment
 * the figure exists: the sub-products are settled, the destinations chosen and
 * the boxes sealed, so the sum over every laboratory is finally computable.
 *
 * **Above the letters on purpose.** A counter refuses a box while the fee is
 * outstanding, so somebody who carried the samples first would have made the
 * journey for nothing.
 */
export default function TestFeePanel({
  applicationId,
  amountPoisha,
  paid,
}: {
  applicationId: number;
  amountPoisha: number;
  paid: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/applications/${applicationId}/test-fee`, {
        method: "POST",
      });
      const json = (await res.json()) as { redirectUrl?: string; error?: string };
      if (!res.ok || !json.redirectUrl) {
        setError(json.error ?? "Could not start the payment.");
        setBusy(false);
        return;
      }
      window.location.href = json.redirectUrl;
    } catch {
      setError("Could not reach the payment gateway.");
      setBusy(false);
    }
  }

  if (paid) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Check className="h-4 w-4 text-primary" strokeWidth={2.2} />
          Testing fee paid
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatPoisha(amountPoisha)} received. Carry each sealed box to the One Stop counter
          named on its letter below — they can accept it now.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/40">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
        <Banknote className="h-4 w-4" strokeWidth={2} />
        Testing fee requested
      </h2>
      <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-200/90">
        The samples have been sealed and the laboratories are known, so the testing fee is now
        settled at <strong>{formatPoisha(amountPoisha)}</strong>. It covers every laboratory your
        samples go to.
      </p>
      <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
        Pay this before you deliver: a One Stop counter cannot accept a sealed box while the fee
        is outstanding, and the journey would be wasted.
      </p>

      {error && (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={pay}
        disabled={busy || amountPoisha <= 0}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Pay testing fee
      </button>
    </section>
  );
}
