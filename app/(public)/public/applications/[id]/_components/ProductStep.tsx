"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";

const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const label = "mb-1.5 block text-xs font-medium text-muted-foreground";

/**
 * What is being certified.
 *
 * Free text rather than a product picker: the product catalogue is Phase G
 * reference data and does not exist. The attached standard carries the product
 * identity; these name the article and brand it is sold under.
 */
export default function ProductStep({
  applicationId,
  productName,
  brandName,
  productDetails,
  editable,
}: {
  applicationId: number;
  productName: string | null;
  brandName: string | null;
  productDetails: string | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    productName: productName ?? "",
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

  if (!editable) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h2 className="font-semibold text-foreground">Product</h2>
        <dl className="mt-4 divide-y divide-border">
          <Row k="Product" v={productName} />
          <Row k="Brand" v={brandName} />
          <Row k="Details" v={productDetails} />
        </dl>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 className="font-semibold text-foreground">Product</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        The article this licence would cover, as it is sold.
      </p>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Product name</label>
          <input
            className={field}
            value={form.productName}
            placeholder="Toilet soap, drinking water…"
            onChange={set("productName")}
          />
        </div>
        <div>
          <label className={label}>Brand name</label>
          <input className={field} value={form.brandName} onChange={set("brandName")} />
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
