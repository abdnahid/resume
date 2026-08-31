"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, AlertTriangle, ShoppingCart, FileText, Info } from "lucide-react";
import { splitFee, takaToPoisha, formatPoisha } from "@/lib/payments/money";

type Option = {
  id: number;
  purchaseNumber: string;
  bds: { id: number; number: string; titleEn: string; status: string; division: string };
  consumedBy: { id: number; applicationNo: string | null } | null;
  selectable: boolean;
  reason?: string;
  warning?: string;
};

/**
 * Attaching the purchased standard (spec §3.4).
 *
 * Because the product *is* the standard, this step is no longer a choice
 * between standards — it is "do you own this one?". The three states the spec
 * sets out map onto that directly: own an unconsumed copy (one click), own only
 * consumed copies (told which application took it, offered another), own none
 * (buy it here, in flow — never sent to the store to lose the draft).
 */
export default function BdsStep({
  applicationId,
  chosenBds,
  options,
  attachedPurchaseId,
  editable,
}: {
  applicationId: number;
  chosenBds: { id: number; number: string; titleEn: string; priceBdt: number } | null;
  options: Option[];
  attachedPurchaseId: number | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function attach(purchaseId: number) {
    setBusy(purchaseId);
    setError(null);
    try {
      const res = await fetch(`/api/client/applications/${applicationId}/bds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not attach that standard.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not attach.");
    } finally {
      setBusy(null);
    }
  }

  /** Buy in flow and come straight back here (§3.4). */
  async function buy() {
    if (!chosenBds) return;
    setBuying(true);
    setError(null);
    try {
      const res = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bdsId: chosenBds.id,
          next: `/public/applications/${applicationId}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the payment.");
      window.location.href = data.redirectUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the payment.");
      setBuying(false);
    }
  }

  if (!chosenBds) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h2 className="font-semibold text-foreground">Your copy of the standard</h2>
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          Choose the product above first. The standard you attach must be the one your product is
          certified against.
        </p>
      </section>
    );
  }

  const price = splitFee(takaToPoisha(chosenBds.priceBdt));
  const usable = options.filter((o) => o.selectable || o.id === attachedPurchaseId);
  const blocked = options.filter((o) => !o.selectable && o.id !== attachedPurchaseId);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 className="font-semibold text-foreground">Your copy of the standard</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Attach your purchase of <strong className="font-medium text-foreground">{chosenBds.number}</strong>.
        A purchase can be used on{" "}
        <strong className="font-medium text-foreground">one application only</strong>.
      </p>

      {usable.length > 0 && (
        <ul className="mt-5 space-y-2">
          {usable.map((o) => {
            const isAttached = o.id === attachedPurchaseId;
            return (
              <li
                key={o.id}
                className={`rounded-xl border p-4 ${
                  isAttached
                    ? "border-primary bg-secondary/40 ring-1 ring-primary/20"
                    : "border-border bg-background"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                      {o.bds.number}
                      {isAttached && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                          <Check className="h-3 w-3" strokeWidth={2.5} />
                          attached
                        </span>
                      )}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {o.purchaseNumber}
                    </p>
                  </div>
                  {editable && !isAttached && (
                    <button
                      type="button"
                      onClick={() => attach(o.id)}
                      disabled={busy !== null}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                    >
                      {busy === o.id && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />}
                      Attach
                    </button>
                  )}
                </div>
                {o.warning && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2} />
                    {o.warning}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {blocked.length > 0 && (
        <ul className="mt-3 space-y-2">
          {blocked.map((o) => (
            <li key={o.id} className="rounded-xl border border-border bg-muted/40 p-4 opacity-75">
              <p className="font-medium text-foreground">{o.bds.number}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">{o.purchaseNumber}</p>
              {o.reason && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2} />
                  {o.reason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Owns none that can be used — buy it here rather than being sent away. */}
      {editable && usable.length === 0 && (
        <div className="mt-5 rounded-xl border border-dashed border-border p-6">
          <FileText className="h-7 w-7 text-primary" strokeWidth={1.6} />
          <p className="mt-3 text-sm font-medium text-foreground">
            {blocked.length > 0
              ? `You own ${chosenBds.number}, but every copy is already used on another application.`
              : `You have not bought ${chosenBds.number} yet.`}
          </p>
          <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
            {chosenBds.titleEn}. Buy it here and you will come straight back to this application —
            your draft is saved.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={buy}
              disabled={buying}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {buying ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              ) : (
                <ShoppingCart className="h-4 w-4" strokeWidth={2} />
              )}
              {buying ? "Opening the gateway…" : `Buy for ${formatPoisha(price.totalPoisha)}`}
            </button>
            <span className="text-xs text-muted-foreground">
              {formatPoisha(price.incomePoisha)} + {formatPoisha(price.vatPoisha)} VAT
            </span>
          </div>
          <Link
            href={`/store/bds`}
            className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
          >
            Or view it in the store
          </Link>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
    </section>
  );
}
