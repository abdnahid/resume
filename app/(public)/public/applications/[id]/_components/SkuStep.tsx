"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Pencil, Package, Info, X, Check } from "lucide-react";

const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const label = "mb-1.5 block text-xs font-medium text-muted-foreground";

export type SizeTypeOption = {
  id: number;
  slug: string;
  nameEn: string;
  nameBn: string | null;
  kind: string;
  hintEn: string | null;
  units: { id: number; code: string; nameEn: string }[];
};

export type Sku = {
  id: number;
  brandName: string;
  variant: string | null;
  sizeValue: string | null;
  packaging: string | null;
  unitsPerPack: number | null;
  grade: string | null;
  labelImageName: string | null;
  labelImageSizeBytes: number | null;
  sizeType: { id: number; nameEn: string; kind: string };
  sizeUnit: { id: number; code: string };
};

type Draft = {
  brandName: string;
  variant: string;
  sizeTypeId: string;
  sizeUnitId: string;
  sizeValue: string;
  packaging: string;
  unitsPerPack: string;
  grade: string;
  labelImageName: string;
  labelImageSizeBytes: number | null;
  labelImageMime: string;
};

const EMPTY: Draft = {
  brandName: "",
  variant: "",
  sizeTypeId: "",
  sizeUnitId: "",
  sizeValue: "",
  packaging: "",
  unitsPerPack: "",
  grade: "",
  labelImageName: "",
  labelImageSizeBytes: null,
  labelImageMime: "",
};

/** `200 ml × 24` — how one SKU's size reads on its row. */
function sizeOf(s: Sku): string {
  const base = s.sizeValue ? `${trimNumber(s.sizeValue)} ${s.sizeUnit.code}` : s.sizeUnit.code;
  return s.unitsPerPack ? `${base} × ${s.unitsPerPack}` : base;
}

/** `200.000` from the database is `200` to a person. */
function trimNumber(v: string): string {
  return v.includes(".") ? v.replace(/0+$/, "").replace(/\.$/, "") : v;
}

/**
 * The articles the licence would cover (D51).
 *
 * One product is sold in many shapes — orange 200 ml in a paper can, mango 2 L
 * in a plastic bottle — and the licence names each of them. The spec makes
 * *inclusion* of a new brand/type/size/flavour/grade its own wing service, which
 * is why these are rows that can be added one at a time rather than a paragraph
 * rewritten each time.
 *
 * The size type is chosen before the unit, so the unit list is only ever the
 * ones that make sense: a biscuit cannot be measured in litres. A size chart
 * type (S/M/L) carries no number at all, and the form stops asking for one.
 */
export default function SkuStep({
  applicationId,
  productName,
  skus,
  sizeTypes,
  editable,
}: {
  applicationId: number;
  productName: string | null;
  skus: Sku[];
  sizeTypes: SizeTypeOption[];
  editable: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chosenType = useMemo(
    () => sizeTypes.find((t) => String(t.id) === draft?.sizeTypeId) ?? null,
    [sizeTypes, draft?.sizeTypeId],
  );
  const isCategorical = chosenType?.kind === "categorical";

  /** Most applications repeat one brand, so carry the last one forward. */
  function startAdd() {
    setError(null);
    setEditingId(null);
    setDraft({ ...EMPTY, brandName: skus.length > 0 ? skus[skus.length - 1].brandName : "" });
  }

  function startEdit(s: Sku) {
    setError(null);
    setEditingId(s.id);
    setDraft({
      brandName: s.brandName,
      variant: s.variant ?? "",
      sizeTypeId: String(s.sizeType.id),
      sizeUnitId: String(s.sizeUnit.id),
      sizeValue: s.sizeValue ? trimNumber(s.sizeValue) : "",
      packaging: s.packaging ?? "",
      unitsPerPack: s.unitsPerPack ? String(s.unitsPerPack) : "",
      grade: s.grade ?? "",
      labelImageName: s.labelImageName ?? "",
      labelImageSizeBytes: s.labelImageSizeBytes,
      labelImageMime: "",
    });
  }

  const set = (k: keyof Draft) => (e: { target: { value: string } }) => {
    const v = e.target.value;
    setDraft((d) => {
      if (!d) return d;
      // Changing the size type invalidates the unit under it, and any number
      // typed for a chart size.
      if (k === "sizeTypeId") {
        const t = sizeTypes.find((x) => String(x.id) === v);
        return {
          ...d,
          sizeTypeId: v,
          sizeUnitId: "",
          sizeValue: t?.kind === "categorical" ? "" : d.sizeValue,
        };
      }
      return { ...d, [k]: v };
    });
  };

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        skuId: editingId ?? undefined,
        brandName: draft.brandName,
        variant: draft.variant,
        sizeTypeId: Number(draft.sizeTypeId),
        sizeUnitId: Number(draft.sizeUnitId),
        sizeValue: isCategorical ? null : draft.sizeValue,
        packaging: draft.packaging,
        unitsPerPack: draft.unitsPerPack,
        grade: draft.grade,
        labelImageName: draft.labelImageName || null,
        labelImageSizeBytes: draft.labelImageSizeBytes,
        labelImageMime: draft.labelImageMime || null,
      };
      const res = await fetch(`/api/client/applications/${applicationId}/skus`, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not save that variant.");
      setDraft(null);
      setEditingId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that variant.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(skuId: number) {
    setRemoving(skuId);
    setError(null);
    try {
      const res = await fetch(`/api/client/applications/${applicationId}/skus`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skuId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not remove that variant.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove that variant.");
    } finally {
      setRemoving(null);
    }
  }

  if (!productName) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h2 className="font-semibold text-foreground">Variants covered by this licence</h2>
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          Choose the product above first. The variants you list are the articles that licence would
          cover.
        </p>
      </section>
    );
  }

  const brands = new Set(skus.map((s) => s.brandName));

  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-semibold text-foreground">Variants covered by this licence</h2>
        {skus.length > 0 && (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {skus.length} {skus.length === 1 ? "variant" : "variants"}
            {brands.size > 1 && ` · ${brands.size} brands`}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        List every article you sell as {productName} — each brand, flavour, size and pack. The
        licence names them, and they decide how many samples are drawn at inspection, so a variant
        left off is one you may not sell under it.
      </p>

      {skus.length > 0 && (
        <div className="mt-5 -mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <Th>Brand</Th>
                <Th>Variant</Th>
                <Th>Size</Th>
                <Th>Packaging</Th>
                <Th>Grade</Th>
                {editable && <th className="w-20 pb-2" />}
              </tr>
            </thead>
            <tbody>
              {skus.map((s) => (
                <tr key={s.id} className="border-b border-border/60 last:border-0">
                  <Td strong>{s.brandName}</Td>
                  <Td>{s.variant}</Td>
                  <Td strong>
                    {sizeOf(s)}
                    <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                      {s.sizeType.nameEn.toLowerCase()}
                    </span>
                  </Td>
                  <Td>{s.packaging}</Td>
                  <Td>{s.grade}</Td>
                  {editable && (
                    <td className="py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(s)}
                          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          aria-label={`Edit ${s.brandName}`}
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(s.id)}
                          disabled={removing !== null}
                          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                          aria-label={`Remove ${s.brandName}`}
                        >
                          {removing === s.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                          )}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {skus.length === 0 && !draft && (
        <div className="mt-5 rounded-xl border border-dashed border-border px-5 py-8 text-center">
          <Package className="mx-auto h-7 w-7 text-primary" strokeWidth={1.6} />
          <p className="mt-3 text-sm font-medium text-foreground">No variants listed yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            A licence has to name what it covers. Add one row for each brand, flavour, size and pack
            you sell — for a drink that might be orange 200 ml in a paper can, mango 2 litre in a
            plastic bottle, and so on.
          </p>
        </div>
      )}

      {draft && (
        <div className="mt-5 rounded-xl border border-primary/40 bg-secondary/30 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              {editingId ? "Edit variant" : "Add a variant"}
            </p>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setEditingId(null);
                setError(null);
              }}
              className="rounded-lg p-1.5 text-muted-foreground transition hover:text-foreground"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>
                Brand <span className="text-destructive">*</span>
              </label>
              <input
                className={field}
                value={draft.brandName}
                placeholder="The brand it is sold under"
                onChange={set("brandName")}
              />
            </div>
            <div>
              <label className={label}>Variant / flavour</label>
              <input
                className={field}
                value={draft.variant}
                placeholder="Orange, Mango, Whole wheat…"
                onChange={set("variant")}
              />
            </div>

            <div>
              <label className={label}>
                Size measured by <span className="text-destructive">*</span>
              </label>
              <select className={field} value={draft.sizeTypeId} onChange={set("sizeTypeId")}>
                <option value="">Choose…</option>
                {sizeTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nameEn}
                  </option>
                ))}
              </select>
              {chosenType?.hintEn && (
                <p className="mt-1 text-[11px] text-muted-foreground">{chosenType.hintEn}</p>
              )}
            </div>

            <div>
              <label className={label}>
                {isCategorical ? "Size" : "Value and unit"}{" "}
                <span className="text-destructive">*</span>
              </label>
              <div className="flex gap-2">
                {/* A chart size is the whole answer — asking for a number
                    beside it would only get an invented one. */}
                {!isCategorical && (
                  <input
                    className={`${field} w-28`}
                    value={draft.sizeValue}
                    inputMode="decimal"
                    placeholder="200"
                    disabled={!chosenType}
                    onChange={set("sizeValue")}
                  />
                )}
                <select
                  className={field}
                  value={draft.sizeUnitId}
                  disabled={!chosenType}
                  onChange={set("sizeUnitId")}
                >
                  <option value="">{chosenType ? "Choose…" : "Pick a size type first"}</option>
                  {(chosenType?.units ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {isCategorical ? `${u.code} — ${u.nameEn}` : `${u.code} (${u.nameEn})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={label}>Packaging</label>
              <input
                className={field}
                value={draft.packaging}
                placeholder="Paper-based can, plastic bottle, PP sack…"
                onChange={set("packaging")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>Units per pack</label>
                <input
                  className={field}
                  value={draft.unitsPerPack}
                  inputMode="numeric"
                  placeholder="24"
                  onChange={set("unitsPerPack")}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Multipacks only</p>
              </div>
              <div>
                <label className={label}>Grade / class</label>
                <input
                  className={field}
                  value={draft.grade}
                  placeholder="Grade A"
                  onChange={set("grade")}
                />
              </div>
            </div>

            {/* The label belongs to the article, not the application: every
                brand, size and flavour is sold in its own wrapper, so one
                artwork per file could only ever describe one of them. */}
            <div className="mt-5 border-t border-border pt-5">
              <label className={label}>Packaging label / artwork for this variant</label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            labelImageName: f?.name ?? "",
                            labelImageSizeBytes: f?.size ?? null,
                            labelImageMime: f?.type ?? "",
                          }
                        : d,
                    );
                  }}
                  className="block w-full max-w-sm text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-secondary/50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
                />
                {draft.labelImageName && (
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) =>
                        d ? { ...d, labelImageName: "", labelImageSizeBytes: null, labelImageMime: "" } : d,
                      )
                    }
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                <strong className="font-medium text-foreground">
                  The file itself is not stored yet.
                </strong>{" "}
                BSTI&apos;s document store is not built, so only the file name is recorded against
                this variant — bring the artwork with you. JPEG, PNG, WebP or PDF, up to 8 MB.
              </p>
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              ) : (
                <Check className="h-4 w-4" strokeWidth={2.5} />
              )}
              {editingId ? "Save variant" : "Add variant"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setEditingId(null);
                setError(null);
              }}
              className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {editable && !draft && (
        <button
          type="button"
          onClick={startAdd}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary bg-secondary/50 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-secondary"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          {skus.length === 0 ? "Add the first variant" : "Add another variant"}
        </button>
      )}

      {error && !draft && <p className="mt-4 text-sm text-destructive">{error}</p>}
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </th>
  );
}

function Td({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <td
      className={`py-2.5 pr-4 align-top ${
        strong ? "font-medium text-foreground" : "text-muted-foreground"
      }`}
    >
      {children || <span className="text-muted-foreground/50">—</span>}
    </td>
  );
}
