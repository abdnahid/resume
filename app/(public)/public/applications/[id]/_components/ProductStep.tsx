"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, ShieldCheck, X, AlertTriangle } from "lucide-react";

const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

type Hit = {
  id: number;
  serial: number;
  nameEn: string;
  nameBn: string | null;
  genericNames: string[];
  category: { letter: string; nameEn: string };
  standards: {
    id: number;
    number: string;
    titleEn: string;
    status: string;
    asPrinted: string | null;
    isPrimary: boolean;
  }[];
  eligible: boolean;
  ineligibleReason: string | null;
};

type Category = { letter: string; nameEn: string; nameBn: string | null };

export type ChosenProduct = {
  id: number;
  serial: number;
  nameEn: string;
  nameBn: string | null;
  genericNames: string[];
  category: { letter: string; nameEn: string; nameBn: string | null };
  standards: { id: number; number: string; titleEn: string; asPrinted: string | null }[];
} | null;

/**
 * Choosing the product.
 *
 * **The 315 are the list** (D44). A CM licence is the permission to sell a
 * product the state has placed under compulsory certification, so the choice is
 * made from BSTI's published list and nowhere else — there is no free-text
 * product field. The standards follow from the product rather than being picked
 * beside it: a manufacturer knows they make toilet soap, not BDS 13:2021.
 */
export default function ProductStep({
  applicationId,
  chosen,
  editable,
}: {
  applicationId: number;
  chosen: ChosenProduct;
  editable: boolean;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(productId: number) {
    setError(null);
    try {
      const res = await fetch(`/api/client/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not choose that product.");
      setPicking(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not choose that product.");
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 className="font-semibold text-foreground">Product</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Choose what you make from BSTI&apos;s list of 315 products under mandatory certification.
        Those are the products that may not be sold without a quality licence — the standards your
        article must be certified against follow from the product you pick.
      </p>

      {chosen ? (
        <div className="mt-5 rounded-xl border border-primary/40 bg-secondary/40 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                {chosen.nameEn}
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                  #{chosen.serial} of 315
                </span>
              </p>
              {chosen.nameBn && (
                <p className="mt-1 font-bn text-sm text-muted-foreground">{chosen.nameBn}</p>
              )}
              {chosen.genericNames.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Also known as {chosen.genericNames.join(", ")}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Category {chosen.category.letter} — {chosen.category.nameEn}
              </p>
              <p className="mt-2.5 text-xs font-medium text-foreground">
                Certified against{" "}
                {chosen.standards.length === 1
                  ? "1 standard"
                  : `all ${chosen.standards.length} standards`}
                :
              </p>
              <ul className="mt-1 space-y-0.5">
                {chosen.standards.map((s) => (
                  <li key={s.id} className="text-xs text-muted-foreground">
                    <span className="font-mono">{s.asPrinted ?? s.number}</span> — {s.titleEn}
                  </li>
                ))}
              </ul>
            </div>
            {editable && (
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
              >
                Change
              </button>
            )}
          </div>
        </div>
      ) : editable ? (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border px-5 py-6 text-sm font-semibold text-primary transition hover:border-primary"
        >
          <Search className="h-4 w-4" strokeWidth={2} />
          Choose the product
        </button>
      ) : (
        <p className="mt-5 rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
          No product chosen.
        </p>
      )}

      {/* Changing the product releases the purchases attached for the old one
          (D41), so the applicant is told before they do it rather than after. */}
      {picking && chosen && (
        <p className="mt-4 flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          Choosing a different product releases the standards attached to this application. You keep
          them — they go back to your purchases and can be used on another application.
        </p>
      )}

      {picking && <ProductPicker onPick={choose} onClose={() => setPicking(false)} />}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
    </section>
  );
}

/**
 * Search the 315.
 *
 * Opens showing the list rather than an empty box: a manufacturer who does not
 * know what BSTI calls their article can browse a category, and one who does can
 * type. Debounced, because it runs on every keystroke.
 */
function ProductPicker({
  onPick,
  onClose,
}: {
  onPick: (productId: number) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    box.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q });
        if (category) params.set("category", category);
        const res = await fetch(`/api/store/products/search?${params}`);
        const data = await res.json();
        if (!cancelled) {
          setHits(data.results ?? []);
          setCategories(data.categories ?? []);
          setTotal(data.total ?? null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, category]);

  return (
    <div className="mt-5 rounded-xl border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={2}
          />
          <input
            ref={box}
            className={`${field} pl-9`}
            placeholder="Search by product name, common name, or standard number…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-muted-foreground transition hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {categories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip active={category === null} onClick={() => setCategory(null)}>
            All {total ?? ""}
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.letter}
              active={category === c.letter}
              onClick={() => setCategory(category === c.letter ? null : c.letter)}
            >
              {c.letter} — {c.nameEn}
            </Chip>
          ))}
        </div>
      )}

      <div className="mt-3 max-h-96 overflow-y-auto">
        {loading ? (
          <p className="flex items-center gap-2 px-1 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            Searching…
          </p>
        ) : hits.length === 0 ? (
          <p className="px-1 py-4 text-sm leading-relaxed text-muted-foreground">
            Nothing on the mandatory list matches that. Only these 315 products need a BSTI quality
            licence — if yours is not among them, you do not need one to sell it. Try a broader term
            or another category; if you believe your product should be listed, contact the CM Wing.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  disabled={!h.eligible}
                  onClick={() => h.eligible && onPick(h.id)}
                  className={
                    h.eligible
                      ? "w-full rounded-lg border border-border p-3 text-left transition hover:border-primary hover:bg-secondary/40"
                      : "w-full cursor-not-allowed rounded-lg border border-dashed border-border/70 p-3 text-left opacity-70"
                  }
                >
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    {h.nameEn}
                    {h.eligible && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        <ShieldCheck className="h-2.5 w-2.5" strokeWidth={2.5} />
                        mandatory
                      </span>
                    )}
                    {h.standards.length > 1 && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {h.standards.length} standards needed
                      </span>
                    )}
                  </p>
                  {h.nameBn && (
                    <p className="mt-0.5 font-bn text-xs text-muted-foreground">{h.nameBn}</p>
                  )}
                  {h.genericNames.length > 0 && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Also: {h.genericNames.join(", ")}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {h.standards.map((s) => s.asPrinted ?? s.number).join(" · ")}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {h.category.letter} — {h.category.nameEn}
                  </p>
                  {!h.eligible && h.ineligibleReason && (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                      {h.ineligibleReason}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:border-primary hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}
