"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

/**
 * Which sub-products of the chosen product the applicant actually makes (D67).
 *
 * This is the choice everything downstream hangs on: a sub-product carries its
 * own parameters, its own limits and its own fees, so picking it is what makes
 * a test plan resolvable — and therefore what lets a **test fee be quoted now**
 * rather than only after inspection.
 *
 * The fee shown is the sum across every laboratory that runs the parameters, so
 * it is the whole figure and not one wing's share (D62).
 */

export type SubProductChoice = {
  id: number;
  nameEn: string;
  nameBn: string | null;
  standardAsPrinted: string | null;
  parameterCount: number;
  testFeePoisha: number;
  turnaroundNormalDays: number | null;
};

export type ChosenSubProduct = {
  id: number;
  subProductId: number;
  nameEn: string;
  variantCount: number;
  declaredByFdo: boolean;
};

const taka = (poisha: number) =>
  `৳${(poisha / 100).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;

export default function SubProductStep({
  applicationId,
  productName,
  choices,
  chosen,
  editable,
}: {
  applicationId: number;
  productName: string | null;
  choices: SubProductChoice[];
  chosen: ChosenSubProduct[];
  editable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const picked = new Map(chosen.map((c) => [c.subProductId, c]));
  const totalPoisha = chosen.reduce(
    (a, c) => a + (choices.find((x) => x.id === c.subProductId)?.testFeePoisha ?? 0),
    0,
  );

  async function toggle(choice: SubProductChoice) {
    const already = picked.get(choice.id);
    // Deselecting takes its variants with it, so say so rather than discarding
    // work the applicant typed.
    if (already && already.variantCount > 0) {
      const ok = window.confirm(
        `Removing ${choice.nameEn} also removes the ${already.variantCount} variant` +
          `${already.variantCount === 1 ? "" : "s"} listed under it. Continue?`,
      );
      if (!ok) return;
    }
    setBusy(choice.id);
    setError(null);
    try {
      const res = await fetch(`/api/client/applications/${applicationId}/sub-products`, {
        method: already ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          already ? { applicationSubProductId: already.id } : { subProductId: choice.id },
        ),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Could not save that.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  if (!productName) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h2 className="font-semibold text-foreground">Sub-products</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Choose the product above first — the sub-products follow from it.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-semibold text-foreground">Which of these do you make?</h2>
        {chosen.length > 0 && (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {chosen.length} selected · test fee {taka(totalPoisha)}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {productName} is certified as separate sub-products, each tested against its own
        parameters and limits. Choose every one you manufacture — the tests, the samples
        drawn at inspection and the testing fee all follow from this, and one left off is
        one your licence will not cover.
      </p>

      {choices.length === 0 && (
        <p className="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          BSTI has not published the test parameters for this product yet, so its
          sub-products cannot be listed. Your application can continue; the inspecting
          officer will record what you make.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <ul className="mt-5 space-y-2">
        {choices.map((c) => {
          const on = picked.get(c.id);
          const working = busy === c.id;
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={!editable || working}
                onClick={() => toggle(c)}
                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  on
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/40"
                } ${!editable ? "cursor-default opacity-80" : ""}`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}
                >
                  {working ? (
                    <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.5} />
                  ) : on ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : null}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{c.nameEn}</span>
                  {c.nameBn && (
                    <span className="block font-bn text-sm text-muted-foreground">{c.nameBn}</span>
                  )}
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {c.parameterCount} test{c.parameterCount === 1 ? "" : "s"}
                    {c.standardAsPrinted ? ` · ${c.standardAsPrinted}` : ""}
                    {c.turnaroundNormalDays ? ` · ${c.turnaroundNormalDays} working days` : ""}
                  </span>
                  {on && on.variantCount > 0 && (
                    <span className="mt-1 block text-xs text-primary">
                      {on.variantCount} variant{on.variantCount === 1 ? "" : "s"} listed below
                    </span>
                  )}
                  {on?.declaredByFdo && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Added by the inspecting officer.
                    </span>
                  )}
                </span>

                <span className="shrink-0 text-right text-sm font-medium text-foreground">
                  {taka(c.testFeePoisha)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {chosen.length > 0 && (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Testing fee {taka(totalPoisha)} in total, payable after the inspection report is
          approved. It may change if the officer finds a sub-product not listed here.
        </p>
      )}
    </section>
  );
}
