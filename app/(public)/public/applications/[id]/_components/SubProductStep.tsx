"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Search, Trash2, X } from "lucide-react";

/**
 * Which sub-products of the chosen product the applicant actually makes (D67).
 *
 * This is the choice everything downstream hangs on: a sub-product carries its
 * own parameters, its own limits and its own fees, so picking it is what makes
 * a test plan resolvable — and therefore what lets a **test fee be quoted now**
 * rather than only after inspection.
 *
 * A searchable dropdown to add, and the chosen ones listed beneath it. The list
 * is not a nicety: BDS 1758 has 29 sub-products and BDS 1221 has 30, and the
 * applicant needs to see everything they have ticked while deciding whether
 * they have covered everything they make — which a closed control cannot show.
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

const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

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
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const picked = new Map(chosen.map((c) => [c.subProductId, c]));
  const byId = new Map(choices.map((c) => [c.id, c]));
  const totalPoisha = chosen.reduce(
    (a, c) => a + (byId.get(c.subProductId)?.testFeePoisha ?? 0),
    0,
  );

  /**
   * Only the ones not already chosen. A dropdown that offers what is already on
   * the list invites a click that does nothing.
   */
  const options = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return choices
      .filter((c) => !picked.has(c.id))
      .filter(
        (c) =>
          !needle ||
          [c.nameEn, c.nameBn ?? "", c.standardAsPrinted ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(needle),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choices, q, chosen]);

  useEffect(() => setActive(0), [q, open]);

  useEffect(() => {
    if (open) input.current?.focus();
    else setQ("");
  }, [open]);

  // Close on a click outside or on Escape — a dropdown left open over the rest
  // of the form is worse than no dropdown.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  async function send(method: "POST" | "DELETE", body: object, key: number) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/client/applications/${applicationId}/sub-products`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  function add(c: SubProductChoice) {
    setOpen(false);
    void send("POST", { subProductId: c.id }, c.id);
  }

  function remove(c: ChosenSubProduct) {
    // Removing takes its variants with it, so say so rather than discarding
    // work the applicant typed.
    if (c.variantCount > 0) {
      const ok = window.confirm(
        `Removing ${c.nameEn} also removes the ${c.variantCount} variant` +
          `${c.variantCount === 1 ? "" : "s"} listed under it. Continue?`,
      );
      if (!ok) return;
    }
    void send("DELETE", { applicationSubProductId: c.id }, c.subProductId);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (options.length === 0) return;
      setActive((i) =>
        e.key === "ArrowDown"
          ? (i + 1) % options.length
          : (i - 1 + options.length) % options.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[active]) add(options[active]);
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
        parameters and limits. Add every one you manufacture — the tests, the samples drawn
        at inspection and the testing fee all follow from this, and one left off is one your
        licence will not cover.
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

      {/* ── The dropdown ── */}
      {editable && choices.length > 0 && (
        <div ref={box} className="relative mt-5">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            disabled={options.length === 0 && !open}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={`${field} flex items-center justify-between text-left disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <span className={options.length === 0 ? "text-muted-foreground" : ""}>
              {options.length === 0
                ? "All sub-products added"
                : `Add a sub-product… (${options.length} available)`}
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
          </button>

          {open && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
              <div className="relative border-b border-border">
                <Search
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={2}
                />
                <input
                  ref={input}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Search by name or standard…"
                  className="w-full bg-transparent py-2.5 pl-9 pr-9 text-sm text-foreground outline-none"
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => {
                      setQ("");
                      input.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                )}
              </div>

              {options.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {q ? `Nothing matches “${q}”.` : "All sub-products have been added."}
                </p>
              ) : (
                <ul ref={listRef} role="listbox" className="max-h-72 overflow-y-auto py-1">
                  {options.map((c, i) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === active}
                        data-active={i === active}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => add(c)}
                        className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition ${
                          i === active ? "bg-primary/10" : "hover:bg-muted/50"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground">
                            {c.nameEn}
                          </span>
                          {c.nameBn && (
                            <span className="block font-bn text-sm text-muted-foreground">
                              {c.nameBn}
                            </span>
                          )}
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {c.parameterCount} test{c.parameterCount === 1 ? "" : "s"}
                            {c.turnaroundNormalDays
                              ? ` · ${c.turnaroundNormalDays} working days`
                              : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-medium text-foreground">
                          {taka(c.testFeePoisha)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── What has been chosen ── */}
      {chosen.length === 0 ? (
        choices.length > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Nothing added yet.
          </p>
        )
      ) : (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {chosen.map((c) => {
            const info = byId.get(c.subProductId);
            const working = busy === c.subProductId;
            return (
              <li key={c.id} className="flex items-start gap-3 bg-background px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{c.nameEn}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {info ? `${info.parameterCount} test${info.parameterCount === 1 ? "" : "s"}` : ""}
                    {info?.standardAsPrinted ? ` · ${info.standardAsPrinted}` : ""}
                    {c.variantCount > 0
                      ? ` · ${c.variantCount} variant${c.variantCount === 1 ? "" : "s"} below`
                      : " · no variants listed yet"}
                  </span>
                  {c.declaredByFdo && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Added by the inspecting officer.
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm font-medium text-foreground">
                  {info ? taka(info.testFeePoisha) : "—"}
                </span>
                {editable && (
                  <button
                    type="button"
                    onClick={() => remove(c)}
                    disabled={working}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    aria-label={`Remove ${c.nameEn}`}
                  >
                    {working ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {chosen.length > 0 && (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Testing fee {taka(totalPoisha)} in total, payable after the inspection report is
          approved. It may change if the officer finds a sub-product not listed here.
        </p>
      )}
    </section>
  );
}
