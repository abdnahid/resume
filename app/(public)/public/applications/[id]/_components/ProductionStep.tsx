"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Gauge } from "lucide-react";
import { CAPACITY_AUTHORITIES } from "@/lib/cm/policy";
import { productionSchema, type ProductionValues } from "@/lib/cm/schemas";

const base =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:ring-2";
const okRing = "border-border focus:border-primary focus:ring-primary/15";
const badRing = "border-destructive/60 focus:border-destructive focus:ring-destructive/15";
const label = "mb-1.5 block text-xs font-medium text-muted-foreground";

type Unit = { id: number; code: string; nameEn: string };
type SizeType = { id: number; nameEn: string; kind: string; units: Unit[] };

/**
 * Step 3 — what this plant can make of this product, and what it made.
 *
 * Validated live against `productionSchema`, the same schema the route parses —
 * so "this year's production is more than the approved capacity" is answered
 * while the applicant is still looking at the two numbers, rather than after a
 * save round trip.
 *
 * The unit comes from the SKU vocabulary, so a capacity cannot be given in
 * litres for a product sold by weight. Only measured (`numeric`) types are
 * offered: "shirt size M" is not a quantity anything is produced in.
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

  const typeOfUnit = (unitId: number) =>
    measurable.find((t) => t.units.some((u) => u.id === unitId))?.id ?? measurable[0]?.id ?? 0;

  // Which size type is selected is a UI concern only — it narrows the unit list
  // and is not part of the payload, so it stays outside the form.
  const [sizeTypeId, setSizeTypeId] = useState<number>(
    existing ? typeOfUnit(existing.capacityUnitId) : (measurable[0]?.id ?? 0),
  );
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProductionValues>({
    resolver: zodResolver(productionSchema),
    mode: "onChange",
    defaultValues: {
      authority: existing?.authority ?? "bida",
      registrationNo: existing?.registrationNo ?? "",
      annualCapacityValue: existing?.annualCapacityValue ?? "",
      capacityUnitId: existing?.capacityUnitId ?? (measurable[0]?.units[0]?.id ?? 0),
      currentYearLabel: existing?.currentYearLabel ?? defaultYear(),
      currentYearProduction: existing?.currentYearProduction ?? "",
    },
  });

  const units = measurable.find((t) => t.id === sizeTypeId)?.units ?? [];

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await fetch(`/api/client/applications/${applicationId}/production`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not save.");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Could not save.");
    }
  });

  const cls = (bad: unknown) => `${base} ${bad ? badRing : okRing}`;

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 className="flex items-center gap-2 font-semibold text-foreground">
        <Gauge className="h-4 w-4 text-primary" strokeWidth={1.8} />
        Production capacity
      </h2>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        For this product only. A factory running several product lines has a different capacity for
        each, so give the figures that apply to what you are certifying here.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Capacity approved by" error={errors.authority?.message}>
          <select
            className={cls(errors.authority)}
            disabled={!editable}
            {...register("authority", { onChange: () => setSaved(false) })}
          >
            {CAPACITY_AUTHORITIES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.labelEn} — {a.nameEn}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Registration / approval number" error={errors.registrationNo?.message}>
          <input
            className={cls(errors.registrationNo)}
            placeholder="As printed on the approval"
            disabled={!editable}
            {...register("registrationNo", { onChange: () => setSaved(false) })}
          />
        </Field>

        <div>
          <label className={label} htmlFor="sizeType">
            Measured in
          </label>
          <select
            id="sizeType"
            className={`${base} ${okRing}`}
            value={sizeTypeId}
            disabled={!editable}
            onChange={(e) => {
              const id = Number(e.target.value);
              setSizeTypeId(id);
              const first = measurable.find((t) => t.id === id)?.units[0]?.id ?? 0;
              setValue("capacityUnitId", first, { shouldValidate: true });
              setSaved(false);
            }}
          >
            {measurable.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nameEn}
              </option>
            ))}
          </select>
        </div>

        <Field label="Unit" error={errors.capacityUnitId?.message}>
          <select
            className={cls(errors.capacityUnitId)}
            disabled={!editable}
            {...register("capacityUnitId", { onChange: () => setSaved(false) })}
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} — {u.nameEn}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Approved annual capacity" error={errors.annualCapacityValue?.message}>
          <input
            className={cls(errors.annualCapacityValue)}
            inputMode="decimal"
            placeholder="e.g. 120000"
            disabled={!editable}
            {...register("annualCapacityValue", { onChange: () => setSaved(false) })}
          />
        </Field>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Produced this year" error={errors.currentYearProduction?.message}>
            <input
              className={cls(errors.currentYearProduction)}
              inputMode="decimal"
              placeholder="e.g. 84500"
              disabled={!editable}
              {...register("currentYearProduction", { onChange: () => setSaved(false) })}
            />
          </Field>
          <div className="w-32">
            <label className={label}>Year</label>
            <input
              className={cls(errors.currentYearLabel)}
              placeholder="2025-2026"
              disabled={!editable}
              {...register("currentYearLabel", { onChange: () => setSaved(false) })}
            />
            {errors.currentYearLabel?.message && (
              <p className="mt-1 text-xs text-destructive">{errors.currentYearLabel.message}</p>
            )}
          </div>
        </div>
      </div>

      {serverError && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      )}

      {editable && (
        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />}
            Save
          </button>
          {saved && !isDirty && (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
              Saved
            </span>
          )}
        </div>
      )}
    </form>
  );
}

function Field({
  label: text,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={label}>{text}</label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Bangladesh's fiscal year runs July to June, so the label spans two years. */
function defaultYear() {
  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}
