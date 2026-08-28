/**
 * Salary sheet computation.
 *
 * One function builds the sheet, and both the preview in `FixationModal` and
 * the server-side save call it — so what an operator checks before submitting
 * is by construction what gets stored. Prisma-free (D9): no import here may
 * reach into the query layer, or the fixation modal drags `pg` into the
 * browser bundle.
 *
 * Money is whole taka throughout. The government rates are percentages of
 * basic with floors, and paisa has no place in a pay order.
 */

// ─── Shapes (mirror the Prisma enums without importing them) ─────────────────

export type HeadKind = "earning" | "deduction";
export type HeadBasis = "fixed" | "percent_of_basic" | "house_rent_rule";
export type HouseRentZone = "dhaka" | "divisional_city" | "other_district";

export const HOUSE_RENT_ZONES: HouseRentZone[] = [
  "dhaka",
  "divisional_city",
  "other_district",
];

export const ZONE_LABEL: Record<HouseRentZone, string> = {
  dhaka: "Dhaka",
  divisional_city: "Divisional city",
  other_district: "Other district",
};

export const ZONE_LABEL_BN: Record<HouseRentZone, string> = {
  dhaka: "ঢাকা",
  divisional_city: "বিভাগীয় শহর",
  other_district: "অন্যান্য জেলা",
};

/** One row of the government house rent table. */
export type HouseRentSlab = {
  zone: HouseRentZone;
  minBasic: number;
  /** Null is the open-ended top slab. */
  maxBasic: number | null;
  percent: number;
  minAmount: number;
};

/** A head as it is about to be applied to a fixation. */
export type SheetHead = {
  headId: number;
  code: string;
  nameEn: string;
  nameBn: string;
  kind: HeadKind;
  basis: HeadBasis;
  /**
   * Taka when `fixed`, whole percent when `percent_of_basic`, ignored when
   * `house_rent_rule`. Null is treated as zero and raises a warning.
   */
  value: number | null;
  sortOrder: number;
};

export type SheetLine = SheetHead & {
  amount: number;
  /** How the amount was arrived at, for the preview. */
  basisNote: string;
};

export type SalarySheet = {
  basicSalary: number;
  earnings: SheetLine[];
  deductions: SheetLine[];
  grossEarning: number;
  totalDeduction: number;
  netSalary: number;
  /** Anything an operator should look at before submitting. Never fatal. */
  warnings: string[];
};

// ─── House rent ──────────────────────────────────────────────────────────────

export type HouseRentResult = {
  amount: number;
  slab: HouseRentSlab;
  /** True when the percentage fell below the slab's floor and the floor won. */
  flooredUp: boolean;
};

/**
 * The government rate: a percentage of basic, but never less than the slab's
 * floor. Returns null when no slab covers the basic — which means the rule
 * table is incomplete, not that the employee gets nothing.
 */
export function houseRentFor(
  basicSalary: number,
  zone: HouseRentZone,
  slabs: HouseRentSlab[],
): HouseRentResult | null {
  const slab = slabs.find(
    (s) =>
      s.zone === zone &&
      basicSalary >= s.minBasic &&
      (s.maxBasic === null || basicSalary <= s.maxBasic),
  );
  if (!slab) return null;

  const byPercent = Math.round((basicSalary * slab.percent) / 100);
  const amount = Math.max(byPercent, slab.minAmount);
  return { amount, slab, flooredUp: amount > byPercent };
}

// ─── The sheet ───────────────────────────────────────────────────────────────

export type ComputeInput = {
  basicSalary: number;
  /** Null when the employee's office has no zone set. */
  zone: HouseRentZone | null;
  heads: SheetHead[];
  slabs: HouseRentSlab[];
};

/**
 * Build the full sheet. Basic salary is always the first earning line and is
 * not a head — it comes from the pay scale, so it can never be removed.
 */
export function computeSheet({
  basicSalary,
  zone,
  heads,
  slabs,
}: ComputeInput): SalarySheet {
  const warnings: string[] = [];
  const earnings: SheetLine[] = [];
  const deductions: SheetLine[] = [];

  const ordered = [...heads].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.headId - b.headId,
  );

  for (const head of ordered) {
    let amount = 0;
    let basisNote = "";

    switch (head.basis) {
      case "fixed": {
        amount = Math.max(0, Math.round(head.value ?? 0));
        basisNote = "Fixed amount";
        if (head.value === null) {
          warnings.push(`${head.nameEn} has no amount set — counted as ৳0.`);
        }
        break;
      }

      case "percent_of_basic": {
        const pct = head.value ?? 0;
        amount = Math.max(0, Math.round((basicSalary * pct) / 100));
        basisNote = `${pct}% of basic`;
        if (head.value === null) {
          warnings.push(`${head.nameEn} has no percentage set — counted as ৳0.`);
        }
        break;
      }

      case "house_rent_rule": {
        if (!zone) {
          amount = 0;
          basisNote = "Office has no house rent zone";
          warnings.push(
            `${head.nameEn} could not be computed: this employee's office has no house rent zone set.`,
          );
          break;
        }
        const rent = houseRentFor(basicSalary, zone, slabs);
        if (!rent) {
          amount = 0;
          basisNote = "No rate slab covers this basic";
          warnings.push(
            `${head.nameEn} could not be computed: no ${ZONE_LABEL[zone]} slab covers a basic of ৳${basicSalary.toLocaleString("en-BD")}.`,
          );
          break;
        }
        amount = rent.amount;
        basisNote = rent.flooredUp
          ? `${rent.slab.percent}% of basic, raised to the ৳${rent.slab.minAmount.toLocaleString("en-BD")} minimum`
          : `${rent.slab.percent}% of basic (${ZONE_LABEL[zone]})`;
        break;
      }
    }

    const line: SheetLine = { ...head, amount, basisNote };
    if (head.kind === "earning") earnings.push(line);
    else deductions.push(line);
  }

  const grossEarning =
    basicSalary + earnings.reduce((sum, l) => sum + l.amount, 0);
  const totalDeduction = deductions.reduce((sum, l) => sum + l.amount, 0);
  const netSalary = grossEarning - totalDeduction;

  if (netSalary < 0) {
    warnings.push(
      "Deductions exceed gross pay — this fixation would pay a negative salary.",
    );
  }

  return {
    basicSalary,
    earnings,
    deductions,
    grossEarning,
    totalDeduction,
    netSalary,
    warnings,
  };
}

// ─── Pay scale lookup ────────────────────────────────────────────────────────

export type ScaleStep = { grade: number; step: number; amount: number };

/** The basic a grade pays at a given step, or null if the grid has no such cell. */
export function basicForStep(
  steps: ScaleStep[],
  grade: number,
  step: number,
): number | null {
  return (
    steps.find((s) => s.grade === grade && s.step === step)?.amount ?? null
  );
}

/** Every step defined for a grade, lowest first. */
export function stepsForGrade(steps: ScaleStep[], grade: number): ScaleStep[] {
  return steps.filter((s) => s.grade === grade).sort((a, b) => a.step - b.step);
}

/** NPS-2015 runs grade 1 (highest) to grade 20. */
export const MIN_GRADE = 1;
export const MAX_GRADE = 20;

// ─── View shapes shared by the server and the fixation form ──────────────────
// These live here, in the Prisma-free half, so a client component can import
// them without dragging the query layer — and `pg` — into the browser bundle
// (D9). `lib/salary/queries.ts` is the server half that produces them.

/** A head as the catalogue holds it. */
export type SalaryHeadRecord = {
  id: number;
  code: string;
  nameEn: string;
  nameBn: string;
  kind: HeadKind;
  basis: HeadBasis;
  defaultValue: number | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  note: string | null;
  /** How many fixation lines reference it. A head in use cannot be deleted. */
  usageCount?: number;
};

/** Everything the fixation form needs to compute a sheet client-side. */
export type FixationContext = {
  scale: {
    id: number;
    code: string;
    nameEn: string;
    nameBn: string;
    verified: boolean;
    incrementNote: string | null;
  } | null;
  steps: ScaleStep[];
  slabs: HouseRentSlab[];
  heads: SalaryHeadRecord[];
  zone: HouseRentZone | null;
  officeName: string;
};

/** One saved line, as read back for display. */
export type FixationItemRecord = {
  headId: number;
  code: string;
  nameEn: string;
  nameBn: string;
  kind: HeadKind;
  basis: HeadBasis;
  value: number | null;
  amount: number;
  sortOrder: number;
};

export type FixationReason =
  | "annual"
  | "initial"
  | "increment"
  | "promotion"
  | "punishment"
  | "correction";

export const FIXATION_REASONS: { value: FixationReason; label: string }[] = [
  { value: "annual", label: "Annual (fiscal year)" },
  { value: "initial", label: "Initial fixation" },
  { value: "increment", label: "Special increment" },
  { value: "promotion", label: "Promotion" },
  { value: "punishment", label: "Punishment / demotion" },
  { value: "correction", label: "Correction" },
];

/** One version of a fixation, as read back for the history list. */
export type FixationVersion = {
  id: number;
  grade: number;
  step: number | null;
  basicSalary: number;
  validFrom: string;
  validThru: string;
  salaryStatus: "active" | "expired" | "not_found" | "inactive";
  reason: FixationReason;
  note: string | null;
  grossEarning: number;
  totalDeduction: number;
  netSalary: number;
  supersededAt: string | null;
  createdAt: string;
  createdBy: string | null;
  items: FixationItemRecord[];
  /** True when a salary month has been processed against this version. */
  isLocked: boolean;
};

/**
 * Turn catalogue heads into sheet inputs, applying any per-employee override.
 * Overrides are keyed by head id; a head absent from `selected` is not applied
 * at all.
 */
export function headsToSheetInputs(
  catalogue: SalaryHeadRecord[],
  selected: { headId: number; value: number | null }[],
): SheetHead[] {
  const byId = new Map(catalogue.map((h) => [h.id, h]));
  const inputs: SheetHead[] = [];
  for (const sel of selected) {
    const head = byId.get(sel.headId);
    if (!head) continue;
    inputs.push({
      headId: head.id,
      code: head.code,
      nameEn: head.nameEn,
      nameBn: head.nameBn,
      kind: head.kind,
      basis: head.basis,
      value: head.basis === "house_rent_rule" ? null : sel.value,
      sortOrder: head.sortOrder,
    });
  }
  return inputs;
}
