"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Gauge } from "lucide-react";
import { CAPACITY_AUTHORITIES } from "@/lib/cm/policy";

const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const label = "mb-1.5 block text-xs font-medium text-muted-foreground";

type Unit = { id: number; code: string; nameEn: string };
type SizeType = { id: number; nameEn: string; kind: string; units: Unit[] };

/**
 * Step 3 — what this plant can make of this product, and what it made.
 *
 * The capacity is quoted *from* a registration, so the authority and its number
 * are asked together with it — a figure with no approver behind it is a claim,
 * not a reference.
 *
 * The unit comes from the same vocabulary the SKUs use, so a capacity cannot be
 * given in litres for a product sold by weight. Only measured (`numeric`) types
 * are offered: "shirt size M" is not a quantity anything can be produced in.
 */
export default function ProductionStep({
  applicationId,
  existing,
  sizeTypes,
  editable,
}: {
  applicationId: number;
  existing: {
    authority: string;
    registrationNo: string | null;
    annualCapacityValue: string;
    capacityUnitId: number;
    currentYearLabel: string;
    currentYearProduction: string;
  } | null;
  sizeTypes: SizeType[];
  editable: boolean;
}) {
  const router = useRouter();
  const measurable = sizeTypes.filter((t) => t.kind === "numeric" && t.units.length > 0);

  const unitTypeOf = (unitId: number) =>
    measurable.find((t) => t.units.some((u) => u.id === unitId))?.id ?? measurable[0]?.id ?? 0;

  const [sizeTypeId, setSizeTypeId] = useState<number>(
    existing ? unitTypeOf(existing.capacityUnitId) : (measurable[0]?.id ?? 0),
  );
  const [form, setForm] = useState({
    authority: existing?.authority ?? "bida",
    registrationNo: existing?.registrationNo ?? "",
    annualCapacityValue: existing?.annualCapacityValue ?? "",
    capacityUnitId: existing?.capacityUnitId ?? (measurable[0]?.units[0]?.id ?? 0),
    currentYearLabel: existing?.currentYearLabel ?? defaultYear(),
    currentYearProduction: existing?.currentYearProduction ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const units = measurable.find((t) => t.id === sizeTypeId)?.units ?? [];

  const set =
    (k: keyof typeof form) =>
    (e: { target: { value: string } }) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      setSaved(false);
      setError(null);
    };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/applications/${applicationId}/production`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, capacityUnitId: Number(form.capacityUnitId) }),
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

  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 className="flex items-center gap-2 font-semibold text-foreground">
        <Gauge className="h-4 w-4 text-primary" strokeWidth={1.8} />
        Production capacity
      </h2>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        For this product only. A factory running several product lines has a different capacity for
        each, so give the figures that apply to what you are certifying here.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="authority">
            Capacity approved by
          </label>
          <select
            id="authority"
            className={field}
            value={form.authority}
            onChange={set("authority")}
            disabled={!editable}
          >
            {CAPACITY_AUTHORITIES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.labelEn} — {a.nameEn}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="registrationNo">
            Registration / approval number
            <span className="ml-1 font-normal text-muted-foreground/70">
              {form.authority === "other" ? "(optional)" : ""}
            </span>
          </label>
          <input
            id="registrationNo"
            className={field}
            value={form.registrationNo}
            onChange={set("registrationNo")}
            disabled={!editable}
            placeholder="As printed on the approval"
          />
        </div>

        <div>
          <label className={label} htmlFor="sizeType">
            Measured in
          </label>
          <select
            id="sizeType"
            className={field}
            value={sizeTypeId}
            onChange={(e) => {
              const id = Number(e.target.value);
              setSizeTypeId(id);
              const first = measurable.find((t) => t.id === id)?.units[0]?.id ?? 0;
              setForm((f) => ({ ...f, capacityUnitId: first }));
              setSaved(false);
            }}
            disabled={!editable}
          >
            {measurable.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nameEn}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="capacityUnitId">
            Unit
          </label>
          <select
            id="capacityUnitId"
            className={field}
            value={form.capacityUnitId}
            onChange={set("capacityUnitId")}
            disabled={!editable}
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} — {u.nameEn}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="annualCapacityValue">
            Approved annual capacity
          </label>
          <input
            id="annualCapacityValue"
            className={field}
            inputMode="decimal"
            value={form.annualCapacityValue}
            onChange={set("annualCapacityValue")}
            disabled={!editable}
            placeholder="e.g. 120000"
          />
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div>
            <label className={label} htmlFor="currentYearProduction">
              Produced this year
            </label>
            <input
              id="currentYearProduction"
              className={field}
              inputMode="decimal"
              value={form.currentYearProduction}
              onChange={set("currentYearProduction")}
              disabled={!editable}
              placeholder="e.g. 84500"
            />
          </div>
          <div className="w-32">
            <label className={label} htmlFor="currentYearLabel">
              Year
            </label>
            <input
              id="currentYearLabel"
              className={field}
              value={form.currentYearLabel}
              onChange={set("currentYearLabel")}
              disabled={!editable}
              placeholder="2025-2026"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {editable && (
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />}
            Save
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
              Saved
            </span>
          )}
        </div>
      )}
    </section>
  );
}

/** Bangladesh's fiscal year runs July to June, so the label spans two years. */
function defaultYear() {
  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}
