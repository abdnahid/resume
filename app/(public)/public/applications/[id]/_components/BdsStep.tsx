"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, AlertTriangle, ShoppingCart, FileText } from "lucide-react";

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
 * The BDS attachment step (spec §3.4).
 *
 * Three states, exactly as the spec sets out: a selectable card for an
 * unconsumed purchase; a greyed card naming the application that consumed it;
 * and, owning none, a route to the store. The reason a card is unusable is
 * always shown — "already used on CM-2026-000123" tells the applicant what to
 * do, where a disabled card with no explanation does not.
 */
export default function BdsStep({
  applicationId,
  options,
  attachedPurchaseId,
  editable,
}: {
  applicationId: number;
  options: Option[];
  attachedPurchaseId: number | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
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

  const attached = options.find((o) => o.id === attachedPurchaseId);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 className="font-semibold text-foreground">Bangladesh Standard</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Your product is certified against a published standard. Attach the one you bought — a
        purchase can be used on{" "}
        <strong className="font-medium text-foreground">one application only</strong>.
      </p>

      {options.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center">
          <FileText className="mx-auto h-7 w-7 text-primary" strokeWidth={1.6} />
          <p className="mt-3 text-sm font-medium text-foreground">
            You have not bought a standard yet
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Buy the Bangladesh Standard for your product, then come back to this application — your
            draft is saved.
          </p>
          <Link
            href="/store/bds"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <ShoppingCart className="h-4 w-4" strokeWidth={2} />
            Browse the store
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-5 space-y-2">
            {options.map((o) => {
              const isAttached = o.id === attachedPurchaseId;
              const usable = o.selectable || isAttached;
              return (
                <li
                  key={o.id}
                  className={`rounded-xl border p-4 transition ${
                    isAttached
                      ? "border-primary bg-secondary/40 ring-1 ring-primary/20"
                      : usable
                        ? "border-border bg-background"
                        : "border-border bg-muted/40 opacity-70"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                        {o.bds.number}
                        {o.bds.status === "superseded" && (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                            superseded
                          </span>
                        )}
                        {isAttached && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                            <Check className="h-3 w-3" strokeWidth={2.5} />
                            attached
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{o.bds.titleEn}</p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {o.purchaseNumber}
                      </p>
                    </div>

                    {editable && !isAttached && (
                      <button
                        type="button"
                        onClick={() => attach(o.id)}
                        disabled={!o.selectable || busy !== null}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy === o.id && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />}
                        Attach
                      </button>
                    )}
                  </div>

                  {o.reason && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2} />
                      {o.reason}
                    </p>
                  )}
                  {(isAttached || o.selectable) && o.warning && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2} />
                      {o.warning}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {editable && (
            <Link
              href="/store/bds"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2} />
              Buy another standard
            </Link>
          )}
        </>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {attached?.warning && !editable && (
        <p className="mt-4 text-xs text-muted-foreground">{attached.warning}</p>
      )}
    </section>
  );
}
