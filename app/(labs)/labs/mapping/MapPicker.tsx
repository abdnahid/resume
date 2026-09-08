"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import type { ProductRow } from "@/lib/labs/catalogue";

/**
 * Product, then sub-product.
 *
 * Two steps rather than one long list of 491 packages, because a package name
 * on its own is often meaningless — "Type-1: Alcoholic", "Small particle
 * grade", "Koi, Starter-3" — and only says what it is beneath its product.
 *
 * Navigating writes the query string, so a map is a link somebody can send.
 */
export default function MapPicker({
  products, siblings, currentProductId, currentSubProductId,
}: {
  products: ProductRow[];
  siblings: { id: number; nameEn: string; _count: { parameters: number } }[];
  currentProductId: number | null;
  currentSubProductId: number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return products.slice(0, 12);
    return products.filter((p) => p.nameEn.toLowerCase().includes(needle)).slice(0, 12);
  }, [products, q]);

  const current = products.find((p) => p.id === currentProductId);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="grid gap-4 md:grid-cols-2">
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
                        setOpen(false); setQ("");
                        start(() => router.push(`/labs/mapping?product=${p.id}`));
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary"
                    >
                      <span>{p.nameEn}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.subProducts} package{p.subProducts === 1 ? "" : "s"}
                      </span>
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
            value={currentSubProductId ?? ""}
            disabled={!siblings.length || pending}
            onChange={(e) =>
              start(() => router.push(`/labs/mapping?subProduct=${e.target.value}`))
            }
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50"
          >
            {!siblings.length && <option value="">Choose a product first</option>}
            {siblings.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameEn} — {s._count.parameters} test{s._count.parameters === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
