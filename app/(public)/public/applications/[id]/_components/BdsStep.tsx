"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  AlertTriangle,
  ShoppingCart,
  Info,
  FlaskConical,
} from "lucide-react";
import { splitFee, takaToPoisha, formatPoisha } from "@/lib/payments/money";

export type Requirement = {
  bds: { id: number; number: string; titleEn: string; status: string; division: string };
  asPrinted: string | null;
  isPrimary: boolean;
  attached: { id: number; purchaseNumber: string } | null;
  options: { id: number; purchaseNumber: string; selectable: boolean; reason?: string; warning?: string }[];
  blocked: { id: number; purchaseNumber: string; reason: string }[];
  price: { priceBdt: number; isProvisional: boolean; note?: string };
};

/**
 * Attaching the purchased standards (spec §3.4).
 *
 * One row per standard the product names, because **all of them are required**
 * (D48) — a product certified against three parts needs three purchases, and a
 * single list of "your purchases" could not say which part is still missing.
 *
 * Each row is one of the three states the spec sets out: own an unconsumed copy
 * (one click), own only consumed copies (told which application took it), own
 * none (buy it here, in flow — never sent to the store to lose the draft). A
 * standard bought here attaches itself when the payment settles (D50).
 */
export default function BdsStep({
  applicationId,
  productName,
  requirements,
  returnStep,
  editable,
}: {
  applicationId: number;
  productName: string | null;
  requirements: Requirement[];
  /** The form step to come back to after buying in flow (§3.4, D50). */
  returnStep: number;
  editable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [buying, setBuying] = useState<number | null>(null);
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

  async function detach(purchaseId: number) {
    setBusy(purchaseId);
    setError(null);
    try {
      const res = await fetch(`/api/client/applications/${applicationId}/bds`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not detach that standard.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not detach.");
    } finally {
      setBusy(null);
    }
  }

  /** Buy in flow and come straight back here, already attached (§3.4, D50). */
  async function buy(bdsId: number) {
    setBuying(bdsId);
    setError(null);
    try {
      const res = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bdsId,
          applicationId,
          // Back to the step they left, not to the top of the form. §3.4 is
          // explicit that an in-flow buyer must never lose their place, and
          // dropping the step drops them on the company preview instead of the
          // standards they were part-way through attaching.
          next: `/public/applications/${applicationId}?step=${returnStep}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the payment.");
      window.location.href = data.redirectUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the payment.");
      setBuying(null);
    }
  }

  if (requirements.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h2 className="font-semibold text-foreground">Your copies of the standards</h2>
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          {productName
            ? `${productName} has no standard recorded against it. That is a fault in BSTI's data rather than anything you can fix — please contact the CM Wing.`
            : "Choose the product above first. The standards you attach are the ones your product must be certified against."}
        </p>
      </section>
    );
  }

  const held = requirements.filter((r) => r.attached).length;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-semibold text-foreground">Your copies of the standards</h2>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            held === requirements.length
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {held} of {requirements.length} attached
        </span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {requirements.length === 1
          ? "Attach your purchase of the standard your product is certified against."
          : `${productName ?? "This product"} is certified against ${requirements.length} standards, and the licence covers all of them — so a purchase of each is needed.`}{" "}
        A purchase can be used on{" "}
        <strong className="font-medium text-foreground">one application only</strong>.
      </p>

      <ul className="mt-5 space-y-3">
        {requirements.map((r) => (
          <li
            key={r.bds.id}
            className={`rounded-xl border p-4 ${
              r.attached ? "border-primary bg-secondary/40 ring-1 ring-primary/20" : "border-border"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                  <span className="font-mono text-sm">{r.asPrinted ?? r.bds.number}</span>
                  {r.attached && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                      attached
                    </span>
                  )}
                  {r.bds.status === "superseded" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" strokeWidth={2.5} />
                      superseded
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{r.bds.titleEn}</p>
                {r.attached && (
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {r.attached.purchaseNumber}
                  </p>
                )}
              </div>

              {r.attached
                ? editable && (
                    <button
                      type="button"
                      onClick={() => detach(r.attached!.id)}
                      disabled={busy !== null}
                      className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-destructive hover:text-destructive disabled:opacity-60"
                    >
                      {busy === r.attached.id ? "Releasing…" : "Detach"}
                    </button>
                  )
                : editable &&
                  r.options.length > 0 && (
                    <button
                      type="button"
                      onClick={() => attach(r.options[0].id)}
                      disabled={busy !== null}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                    >
                      {busy === r.options[0].id && (
                        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
                      )}
                      Attach
                    </button>
                  )}
            </div>

            {/* More than one unconsumed copy — name them, rather than silently
                picking one on the applicant's behalf. */}
            {!r.attached && editable && r.options.length > 1 && (
              <ul className="mt-3 space-y-1.5">
                {r.options.slice(1).map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {o.purchaseNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => attach(o.id)}
                      disabled={busy !== null}
                      className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:opacity-60"
                    >
                      Attach this one
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {r.options[0]?.warning && !r.attached && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2} />
                {r.options[0].warning}
              </p>
            )}

            {r.blocked.length > 0 && !r.attached && (
              <ul className="mt-2 space-y-1">
                {r.blocked.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"
                  >
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2} />
                    <span>
                      <span className="font-mono">{b.purchaseNumber}</span> — {b.reason}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Owns none that can be used — buy it here rather than being sent
                away to lose the draft (§3.4). */}
            {!r.attached && editable && r.options.length === 0 && (
              <div className="mt-3 rounded-lg border border-dashed border-border p-4">
                <p className="text-sm text-foreground">
                  {r.blocked.length > 0
                    ? `You own ${r.bds.number}, but every copy is already used on another application.`
                    : `You have not bought ${r.bds.number} yet.`}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Buy it here and it attaches itself to this application — your draft is saved.
                </p>
                {r.price.isProvisional && (
                  <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                    <FlaskConical className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2} />
                    <span>
                      <strong className="font-semibold">Provisional price.</strong> {r.price.note}
                    </span>
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <PriceButton
                    priceBdt={r.price.priceBdt}
                    busy={buying === r.bds.id}
                    disabled={buying !== null}
                    onClick={() => buy(r.bds.id)}
                  />
                  <Link
                    href="/store/bds"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Or view it in the store
                  </Link>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
    </section>
  );
}

function PriceButton({
  priceBdt,
  busy,
  disabled,
  onClick,
}: {
  priceBdt: number;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const price = splitFee(takaToPoisha(priceBdt));
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
        ) : (
          <ShoppingCart className="h-4 w-4" strokeWidth={2} />
        )}
        {busy ? "Opening the gateway…" : `Buy for ${formatPoisha(price.totalPoisha)}`}
      </button>
      <span className="text-xs text-muted-foreground">
        {formatPoisha(price.incomePoisha)} + {formatPoisha(price.vatPoisha)} VAT
      </span>
    </>
  );
}
