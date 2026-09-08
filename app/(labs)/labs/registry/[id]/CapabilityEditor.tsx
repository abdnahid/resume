"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Check, Search } from "lucide-react";
import type { ProductRow } from "@/lib/labs/catalogue";

type Param = {
  id: number; nameEn: string; discipline: string; sourceSection: string;
  held: boolean;
  /** A seeded stand-in stands against this test — not this lab's own answer. */
  seeded: boolean;
};

/**
 * Ticking off what a bench can run, one package at a time.
 *
 * Package by package rather than a flat list of 4,767, because that is how a
 * laboratory thinks about it: "can we do the full milk-powder panel" is one
 * question, and the answer is usually all or nearly all of a package.
 *
 * The whole package is one save. A lab manager going through a standard is
 * making one decision about it, and a round trip per checkbox would make a
 * ninety-line package unbearable.
 */
export default function CapabilityEditor({
  labId, labName, canEdit, products, siblings, currentProductId, subProduct,
}: {
  labId: number;
  labName: string;
  canEdit: boolean;
  products: ProductRow[];
  siblings: { id: number; nameEn: string; _count: { parameters: number } }[];
  currentProductId: number | null;
  subProduct: {
    id: number; nameEn: string; productName: string; parameters: Param[];
  } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Draft state falls back to the prop rather than being synced by an effect:
  // the server render is the truth after every save, and an effect would fight
  // whoever is still ticking.
  const [draft, setDraft] = useState<Record<number, boolean>>({});
  const held = (p: Param) => draft[p.id] ?? p.held;

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return products.slice(0, 12);
    return products.filter((p) => p.nameEn.toLowerCase().includes(needle)).slice(0, 12);
  }, [products, q]);

  const current = products.find((p) => p.id === currentProductId);

  async function save() {
    if (!subProduct) return;
    setError(null); setSaved(null);
    const on = subProduct.parameters.filter((p) => held(p) && !p.held).map((p) => p.id);
    const off = subProduct.parameters.filter((p) => !held(p) && p.held).map((p) => p.id);
    if (!on.length && !off.length) { setSaved("Nothing changed."); return; }

    for (const [ids, isActive] of [[on, true], [off, false]] as const) {
      if (!ids.length) continue;
      const res = await fetch("/api/labs/capability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labId, parameterIds: ids, isActive }),
      });
      const json = (await res.json()) as { error?: string; orphanedRoutings?: number };
      if (!res.ok) { setError(json.error ?? "That did not save."); return; }
      if (json.orphanedRoutings)
        setSaved(
          `Saved. ${json.orphanedRoutings} routing cells now point here for tests this lab no longer runs — they will be refused rather than followed.`,
        );
    }
    setDraft({});
    setSaved((s) => s ?? `Saved for ${labName}.`);
    start(() => router.refresh());
  }

  const changes = subProduct
    ? subProduct.parameters.filter((p) => held(p) !== p.held).length
    : 0;

  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold">Record what this laboratory can run</h2>
        {!canEdit && (
          <p className="mt-1 text-xs text-muted-foreground">
            Read-only for you. A laboratory&rsquo;s capability is recorded by its own office —
            its head or its lab in-charge — or by a superadmin.
          </p>
        )}
      </div>

      <div className="grid gap-4 border-b border-border p-4 md:grid-cols-2">
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Product
          </label>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder={current ? current.nameEn : "Search the 315 products"}
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
            {open && matches.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                {matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false); setQ(""); setDraft({});
                        start(() => router.push(`/labs/registry/${labId}?product=${p.id}`));
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary"
                    >
                      <span>{p.nameEn}</span>
                      <span className="text-xs text-muted-foreground">{p.subProducts} packages</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sub-product
          </label>
          <select
            value={subProduct?.id ?? ""}
            disabled={!siblings.length || pending}
            onChange={(e) => {
              setDraft({});
              start(() => router.push(`/labs/registry/${labId}?subProduct=${e.target.value}`));
            }}
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50"
          >
            {/* A `value` with no matching option leaves the browser showing
                option one, which would read as a package already chosen. */}
            {!siblings.length && <option value="">Choose a product first</option>}
            {siblings.length > 0 && !subProduct && (
              <option value="">— choose a sub-product —</option>
            )}
            {siblings.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameEn} — {s._count.parameters} tests
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="border-b border-border bg-red-50 px-5 py-2.5 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}
      {saved && (
        <p className="flex items-center gap-2 border-b border-border px-5 py-2.5 text-sm">
          <Check className="h-4 w-4 text-primary" /> {saved}
        </p>
      )}

      {subProduct && (
        <>
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-secondary/30 px-5 py-2.5 text-sm">
            <strong>{subProduct.nameEn}</strong>
            <span className="text-muted-foreground">of {subProduct.productName}</span>
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setDraft(Object.fromEntries(subProduct.parameters.map((p) => [p.id, true])))
                  }
                  className="ml-auto rounded-lg border border-border px-2.5 py-1 text-xs hover:border-primary/40"
                >
                  Tick all
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDraft(Object.fromEntries(subProduct.parameters.map((p) => [p.id, false])))
                  }
                  className="rounded-lg border border-border px-2.5 py-1 text-xs hover:border-primary/40"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  disabled={pending || changes === 0}
                  onClick={save}
                  className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
                >
                  Save {changes || ""} change{changes === 1 ? "" : "s"}
                </button>
              </>
            )}
          </div>

          <ul className="divide-y divide-border/60">
            {subProduct.parameters.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={held(p)}
                  disabled={!canEdit || pending}
                  onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.checked }))}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                <span className={held(p) ? "" : "text-muted-foreground"}>{p.nameEn}</span>
                {p.seeded && !p.held && (
                  <span
                    title="A seeded stand-in points here. Tick the box to make it this laboratory's own answer, or leave it and record the real destination on the map."
                    className="cursor-help rounded-full border border-dashed border-amber-400 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300"
                  >
                    seeded
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">{p.discipline}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
