"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Search, ShieldCheck, X, AlertTriangle } from "lucide-react";

const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const label = "mb-1.5 block text-xs font-medium text-muted-foreground";

type Hit = {
  id: number;
  number: string;
  titleEn: string;
  titleBn: string | null;
  status: string;
  priceBdt: number;
  isMandatory315: boolean;
  division: string;
  eligible: boolean;
  ineligibleReason: string | null;
};

export type ChosenBds = {
  id: number;
  number: string;
  titleEn: string;
  status: string;
  division: { nameEn: string };
} | null;

/**
 * Choosing the product.
 *
 * **The BDS catalogue is the product list.** A CM licence certifies conformity
 * to a published standard, so a product BSTI has no standard for is not a
 * product it can certify — which is why this is a search over the catalogue and
 * not a text box. It also makes the standard the applicant must attach a
 * determined fact rather than a judgement call.
 */
export default function ProductStep({
  applicationId,
  chosen,
  brandName,
  productDetails,
  editable,
}: {
  applicationId: number;
  chosen: ChosenBds;
  brandName: string | null;
  productDetails: string | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [form, setForm] = useState({
    brandName: brandName ?? "",
    productDetails: productDetails ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setSaved(false);
  };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not save.");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function choose(bdsId: number) {
    setError(null);
    try {
      const res = await fetch(`/api/client/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bdsId }),
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
        Choose the Bangladesh Standard your product is made to. BSTI certifies against published
        standards, so the standard is the product. Only standards under mandatory certification can
        be licensed — those are the products that may not be sold without a BSTI quality licence.
      </p>

      {chosen ? (
        <div className="mt-5 rounded-xl border border-primary/40 bg-secondary/40 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                {chosen.number}
                {chosen.status === "superseded" && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    superseded
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{chosen.titleEn}</p>
              <p className="mt-1 text-xs text-muted-foreground">{chosen.division.nameEn}</p>
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

      {picking && <ProductPicker onPick={choose} onClose={() => setPicking(false)} />}

      {/* Brand and variants sit under the product, because that is what they
          qualify — the standard says what the article is, these say how this
          applicant sells it. */}
      {editable ? (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Brand name</label>
              <input
                className={field}
                value={form.brandName}
                placeholder="The brand this is sold under"
                onChange={set("brandName")}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Variants, pack sizes or grades covered</label>
              <textarea
                className={`${field} min-h-20 resize-y`}
                value={form.productDetails}
                onChange={set("productDetails")}
              />
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-primary bg-secondary/50 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-secondary disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
            {saved && !busy && <Check className="h-4 w-4" strokeWidth={2.5} />}
            {busy ? "Saving…" : saved ? "Saved" : "Save"}
          </button>
        </>
      ) : (
        <dl className="mt-6 divide-y divide-border">
          <Row k="Brand" v={brandName} />
          <Row k="Variants" v={productDetails} />
        </dl>
      )}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3">
      <dt className="text-xs font-medium text-muted-foreground">{k}</dt>
      <dd className={`text-sm sm:col-span-2 ${v ? "text-foreground" : "text-muted-foreground italic"}`}>
        {v || "Not given"}
      </dd>
    </div>
  );
}

/** Search the catalogue. Debounced, because it runs on every keystroke. */
function ProductPicker({
  onPick,
  onClose,
}: {
  onPick: (bdsId: number) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
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
        const res = await fetch(`/api/store/bds/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!cancelled) setHits(data.results ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

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
            placeholder="Search by standard number or product…"
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

      <div className="mt-3 max-h-80 overflow-y-auto">
        {loading ? (
          <p className="flex items-center gap-2 px-1 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            Searching…
          </p>
        ) : hits.length === 0 ? (
          <p className="px-1 py-4 text-sm text-muted-foreground">
            No standard matches that. BSTI can only certify products it has published a standard
            for — try a broader term, or search the{" "}
            <a href="/store/bds" className="font-medium text-primary hover:underline">
              full catalogue
            </a>
            .
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
                    {h.number}
                    {h.isMandatory315 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        <ShieldCheck className="h-2.5 w-2.5" strokeWidth={2.5} />
                        mandatory
                      </span>
                    )}
                    {h.status === "superseded" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-2.5 w-2.5" strokeWidth={2.5} />
                        superseded
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{h.titleEn}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{h.division}</p>
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
