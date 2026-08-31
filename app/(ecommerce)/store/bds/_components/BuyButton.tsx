"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Loader2, LogIn, FlaskConical } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { splitFee, takaToPoisha, formatPoisha } from "@/lib/payments/money";

/**
 * Buy a standard.
 *
 * The session is read client-side, not passed down from the page: awaiting one
 * on the server would opt the catalogue out of static generation, the same
 * failure class as `useSearchParams()` in a shared layout.
 *
 * The VAT split is shown before the payer commits, computed by the same
 * `splitFee()` the server charges with — so the figure on the button is the
 * figure on the challan, for the same reason `computeSheet()` is called by both
 * the payroll preview and the save route.
 */
export default function BuyButton({
  bdsId,
  priceBdt,
  isSandbox,
}: {
  bdsId: number;
  priceBdt: number;
  isSandbox: boolean;
}) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const split = splitFee(takaToPoisha(priceBdt));

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bdsId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the payment.");
      // Leaving for the gateway.
      window.location.href = data.redirectUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the payment.");
      setBusy(false);
    }
  }

  return (
    <div>
      <dl className="mb-4 space-y-1.5 rounded-xl bg-muted px-3.5 py-3 text-[12.5px]">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Price</dt>
          <dd className="text-body">{formatPoisha(split.incomePoisha)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">VAT ({split.vatRateBp / 100}%)</dt>
          <dd className="text-body">{formatPoisha(split.vatPoisha)}</dd>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-1.5 font-semibold">
          <dt className="text-title">Total</dt>
          <dd className="text-title">{formatPoisha(split.totalPoisha)}</dd>
        </div>
      </dl>

      {isPending ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-[14px] font-semibold text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          Loading
        </div>
      ) : session ? (
        <button
          type="button"
          onClick={buy}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-[14px] font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <ShoppingCart className="h-4 w-4" strokeWidth={2} />
          )}
          {busy ? "Opening the gateway…" : `Buy — ${formatPoisha(split.totalPoisha)}`}
        </button>
      ) : (
        <button
          type="button"
          onClick={() =>
            router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)
          }
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-[14px] font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <LogIn className="h-4 w-4" strokeWidth={2} />
          Sign in to buy
        </button>
      )}

      {error && <p className="mt-3 text-[12.5px] text-destructive">{error}</p>}

      {isSandbox && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-amber-800 dark:text-amber-300">
          <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span>
            Payments run on a <strong className="font-semibold">sandbox gateway</strong>. Nothing is
            charged and no card or wallet is contacted.
          </span>
        </p>
      )}
    </div>
  );
}
