"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2, PackagePlus, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";

/**
 * What the officer found on the factory floor that the applicant did not
 * declare (D89).
 *
 * **It goes on the application, not on the letter.** A sub-product added to the
 * sampling letter alone would be sealed and tested but not applied for: no
 * routing, no parameters, no test fee, and a licence that does not cover the
 * article the jar came from. `declaredBy` keeps the two apart, so "did they
 * under-declare, or did we find more" stays answerable (D67).
 *
 * **Closed once the jars are sealed.** The plan cannot be regenerated, so a
 * variant added afterwards would be licensed without ever having been sampled —
 * the service refuses, and this hides rather than offering a button that will.
 */

export type Choice = {
  id: number;
  nameEn: string;
  parameterCount: number;
  testFeeTaka: string;
};

export type Declared = {
  applicationSubProductId: number;
  name: string;
  byFdo: boolean;
  /** Declared, but the factory was not making it at the visit (D91). */
  struckOut: boolean;
  skus: { id: number; label: string; byFdo: boolean; struckOut: boolean }[];
};

export default function FoundAtFactoryPanel({
  applicationId,
  declared,
  choices,
  sizeTypes,
  sealed,
}: {
  applicationId: number;
  declared: Declared[];
  /** Sub-products of this product that are not on the application yet. */
  choices: Choice[];
  sizeTypes: { id: number; nameEn: string; kind: string; units: { id: number; code: string }[] }[];
  sealed: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [sku, setSku] = useState({
    brandName: "",
    variant: "",
    sizeTypeId: "",
    sizeUnitId: "",
    sizeValue: "",
    packaging: "",
    grade: "",
  });

  async function send(action: string, body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/workflow/applications/${applicationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "That did not work.");
      setAddingTo(null);
      setSku({ brandName: "", variant: "", sizeTypeId: "", sizeUnitId: "", sizeValue: "", packaging: "", grade: "" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  if (sealed) {
    const found = declared.filter((d) => d.byFdo || d.skus.some((s) => s.byFdo));
    if (found.length === 0) return null;
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-medium text-foreground">Found at the factory</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Recorded before the samples were sealed. It cannot be changed now — the
          jars are in the applicant&rsquo;s custody.
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {found.map((d) => (
            <li key={d.applicationSubProductId} className="text-foreground">
              {d.name}
              {d.byFdo && <span className="ml-2 text-xs text-primary">sub-product you found</span>}
              {d.skus.filter((s) => s.byFdo).length > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {d.skus.filter((s) => s.byFdo).length} variant(s) you found
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const q = query.trim().toLowerCase();
  const shown = q ? choices.filter((c) => c.nameEn.toLowerCase().includes(q)) : choices;
  const type = sizeTypes.find((t) => String(t.id) === sku.sizeTypeId);
  const field =
    "rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none";

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-medium text-foreground">
        <PackagePlus className="h-4 w-4 text-primary" strokeWidth={2} />
        Found at the factory
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Anything the applicant did not declare goes on the application, not just
        on the letter — otherwise it would be sampled and tested but not
        licensed. What you add is marked as your finding. A line they declared
        but are no longer making is <em>struck out</em>, not deleted: it stops
        being sampled, charged for and licensed, and their declaration stays on
        the file.
      </p>

      {/* What is on the file now, so he adds to it rather than beside it. */}
      <ul className="mt-4 space-y-2">
        {declared.map((d) => (
          <li key={d.applicationSubProductId} className="rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`text-sm font-medium ${
                  d.struckOut ? "text-muted-foreground line-through" : "text-foreground"
                }`}
              >
                {d.name}
                {d.byFdo && (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary no-underline">
                    you found this
                  </span>
                )}
                {d.struckOut && (
                  <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground no-underline">
                    not in production
                  </span>
                )}
              </span>
              <span className="flex items-center gap-3">
                {!d.struckOut && (
                  <button
                    type="button"
                    onClick={() =>
                      setAddingTo(addingTo === d.applicationSubProductId ? null : d.applicationSubProductId)
                    }
                    className="cursor-pointer text-xs font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {addingTo === d.applicationSubProductId ? "Cancel" : "Add a variant"}
                  </button>
                )}
                {/* Their declaration is struck out rather than deleted, and can
                    be put back until the jars are sealed (D91). */}
                {!d.byFdo && (
                  <button
                    type="button"
                    onClick={() =>
                      send(
                        "in-production",
                        {
                          applicationSubProductId: d.applicationSubProductId,
                          inProduction: d.struckOut,
                        },
                        `sx-sp-${d.applicationSubProductId}`,
                      )
                    }
                    disabled={busy !== null}
                    className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    {busy === `sx-sp-${d.applicationSubProductId}` ? (
                      <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
                    ) : d.struckOut ? (
                      <RotateCcw className="h-3 w-3" strokeWidth={2} />
                    ) : (
                      <Ban className="h-3 w-3" strokeWidth={2} />
                    )}
                    {d.struckOut ? "Still made" : "Not in production"}
                  </button>
                )}
                {/* Only his own findings: removing what the applicant declared
                    would erase their declaration (D89). */}
                {d.byFdo && (
                  <button
                    type="button"
                    onClick={() =>
                      send(
                        "unfound-sub-product",
                        { applicationSubProductId: d.applicationSubProductId },
                        `rm-sp-${d.applicationSubProductId}`,
                      )
                    }
                    disabled={busy !== null}
                    className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                  >
                    {busy === `rm-sp-${d.applicationSubProductId}` ? (
                      <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
                    ) : (
                      <Trash2 className="h-3 w-3" strokeWidth={2} />
                    )}
                    Remove
                  </button>
                )}
              </span>
            </div>
            {d.skus.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">No variants named.</p>
            ) : (
              <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {d.skus.map((k) => (
                  <li key={k.id} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <span className={k.struckOut ? "line-through" : ""}>{k.label}</span>
                    {!k.byFdo && (
                      <button
                        type="button"
                        onClick={() =>
                          send("in-production", { skuId: k.id, inProduction: k.struckOut }, `sx-${k.id}`)
                        }
                        disabled={busy !== null}
                        aria-label={k.struckOut ? `Restore ${k.label}` : `Mark ${k.label} not in production`}
                        className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                      >
                        {busy === `sx-${k.id}` ? (
                          <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
                        ) : k.struckOut ? (
                          <RotateCcw className="h-3 w-3" strokeWidth={2} />
                        ) : (
                          <Ban className="h-3 w-3" strokeWidth={2} />
                        )}
                      </button>
                    )}
                    {k.byFdo && (
                      <>
                        <span className="text-primary">(found)</span>
                        <button
                          type="button"
                          onClick={() => send("unfound-sku", { skuId: k.id }, `rm-sku-${k.id}`)}
                          disabled={busy !== null}
                          aria-label={`Remove ${k.label}`}
                          className="cursor-pointer text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                        >
                          {busy === `rm-sku-${k.id}` ? (
                            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
                          ) : (
                            <X className="h-3 w-3" strokeWidth={2} />
                          )}
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {addingTo === d.applicationSubProductId && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <input
                  value={sku.brandName}
                  onChange={(e) => setSku((s) => ({ ...s, brandName: e.target.value }))}
                  placeholder="Brand *"
                  className={field}
                />
                <input
                  value={sku.variant}
                  onChange={(e) => setSku((s) => ({ ...s, variant: e.target.value }))}
                  placeholder="Variant or flavour"
                  className={field}
                />
                <input
                  value={sku.packaging}
                  onChange={(e) => setSku((s) => ({ ...s, packaging: e.target.value }))}
                  placeholder="Packaging"
                  className={field}
                />
                <select
                  value={sku.sizeTypeId}
                  onChange={(e) =>
                    setSku((s) => ({ ...s, sizeTypeId: e.target.value, sizeUnitId: "" }))
                  }
                  className={field}
                >
                  <option value="">How is it measured? *</option>
                  {sizeTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nameEn}
                    </option>
                  ))}
                </select>
                <select
                  value={sku.sizeUnitId}
                  onChange={(e) => setSku((s) => ({ ...s, sizeUnitId: e.target.value }))}
                  disabled={!type}
                  className={field}
                >
                  <option value="">Unit *</option>
                  {type?.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code}
                    </option>
                  ))}
                </select>
                {/* A size chart *is* the answer, so the form stops asking for a
                    number — the same rule the applicant's form follows (D51). */}
                {type?.kind !== "categorical" && (
                  <input
                    value={sku.sizeValue}
                    onChange={(e) => setSku((s) => ({ ...s, sizeValue: e.target.value }))}
                    placeholder="Size *"
                    inputMode="decimal"
                    className={field}
                  />
                )}
                <button
                  type="button"
                  onClick={() =>
                    send(
                      "found-sku",
                      {
                        applicationSubProductId: d.applicationSubProductId,
                        sku: {
                          brandName: sku.brandName,
                          variant: sku.variant || null,
                          packaging: sku.packaging || null,
                          grade: sku.grade || null,
                          sizeTypeId: Number(sku.sizeTypeId),
                          sizeUnitId: Number(sku.sizeUnitId),
                          sizeValue: type?.kind === "categorical" ? null : sku.sizeValue,
                        },
                      },
                      `sku-${d.applicationSubProductId}`,
                    )
                  }
                  disabled={busy !== null || !sku.brandName.trim() || !sku.sizeUnitId}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {busy === `sku-${d.applicationSubProductId}` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                  Add
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {choices.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Another sub-product of this product
          </p>
          <div className="relative mt-2">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.8}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the sub-products…"
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-8 text-sm focus:border-primary focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear"
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            )}
          </div>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {shown.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted"
              >
                <span className="min-w-0 text-sm text-foreground">
                  {c.nameEn}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {c.parameterCount} tests · ৳{c.testFeeTaka}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => send("found-sub-product", { subProductId: c.id }, `sp-${c.id}`)}
                  disabled={busy !== null}
                  className="shrink-0 cursor-pointer rounded-lg border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
                >
                  {busy === `sp-${c.id}` ? (
                    <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
                  ) : (
                    "Add"
                  )}
                </button>
              </li>
            ))}
            {shown.length === 0 && (
              <li className="px-2 py-2 text-sm text-muted-foreground">
                Nothing else on this product matches.
              </li>
            )}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Adding one changes the sampling plan and the test fee — it brings its
            own parameters and its own laboratory.
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
  );
}
