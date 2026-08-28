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
  /** Zeroed by a verdict. The line still shows, so the loss is visible. */
  suppressed?: boolean;
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
  /** What a court verdict changed, if one is in force. */
  verdictNotes: string[];
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

// ─── Court verdicts ──────────────────────────────────────────────────────────

export type VerdictClauseType =
  | "reduce_increments"
  | "withhold_increment"
  | "demote_grade"
  | "basic_percent"
  | "suppress_allowances"
  | "suppress_head";

export type VerdictClause = {
  type: VerdictClauseType;
  value: number | null;
  headId: number | null;
};

export type ActiveVerdict = {
  id: number;
  orderNo: string;
  summary: string;
  /** See `CaseVerdict.reduceDerivedAllowances` — answers "rest remains same". */
  reduceDerivedAllowances: boolean;
  clauses: VerdictClause[];
};

export const CLAUSE_LABEL: Record<VerdictClauseType, string> = {
  reduce_increments: "Reduce increments",
  withhold_increment: "Withhold increment",
  demote_grade: "Demote to grade",
  basic_percent: "Percentage of basic",
  suppress_allowances: "Cancel all allowances",
  suppress_head: "Cancel one allowance or deduction",
};

/** What a clause's `value` means, for the entry form. */
export const CLAUSE_VALUE_HINT: Record<VerdictClauseType, string | null> = {
  reduce_increments: "How many increments to come down",
  withhold_increment: "For how many years",
  demote_grade: "The grade to be paid on",
  basic_percent: "Percent of basic to pay (50 = half)",
  suppress_allowances: null,
  suppress_head: null,
};

export type VerdictEffect = {
  /** The grade and step actually paid, after demotion and lost increments. */
  grade: number;
  step: number;
  /** The scale figure for that grade and step, before any percentage cut. */
  scaleBasic: number;
  /** What is actually paid as basic. */
  basicSalary: number;
  /** The figure percentage-based heads are computed on. */
  percentBase: number;
  /** Heads that the verdict silences. */
  suppressedHeadIds: number[];
  suppressAllAllowances: boolean;
  /** Human-readable account of what the verdict did, for the preview. */
  notes: string[];
};

/**
 * Work out what a verdict does to a grade and step, before any head is priced.
 *
 * Order is fixed and matters:
 *   1. `demote_grade`   — changes which column of the grid we read
 *   2. `reduce_increments` — moves down that column
 *   3. resolve the scale basic for the resulting grade and step
 *   4. `basic_percent`  — cuts what is paid, and (only if the verdict says so)
 *                         the base that percentage allowances are priced on
 *   5. suppression clauses — recorded here, applied when the sheet is built
 *
 * `withhold_increment` deliberately does nothing here: it constrains the *next*
 * annual fixation rather than this one's arithmetic, and is surfaced to the
 * operator instead.
 */
export function applyVerdict(
  grade: number,
  step: number,
  steps: ScaleStep[],
  verdict: ActiveVerdict | null,
): VerdictEffect {
  const notes: string[] = [];
  let effGrade = grade;
  let effStep = step;

  const clauseOf = (t: VerdictClauseType) =>
    verdict?.clauses.find((c) => c.type === t) ?? null;

  const demote = clauseOf("demote_grade");
  if (demote?.value != null) {
    effGrade = demote.value;
    notes.push(`Paid on grade ${effGrade} instead of grade ${grade}.`);
  }

  const reduce = clauseOf("reduce_increments");
  if (reduce?.value != null && reduce.value > 0) {
    const before = effStep;
    effStep = Math.max(0, effStep - reduce.value);
    notes.push(
      `Down ${reduce.value} increment${reduce.value === 1 ? "" : "s"} — step ${before} to ${effStep}.`,
    );
  }

  // A demoted grade may not have as many rungs; fall back to its highest.
  const column = stepsForGrade(steps, effGrade);
  let cell = column.find((s) => s.step === effStep);
  if (!cell && column.length) {
    cell = column[column.length - 1];
    notes.push(
      `Grade ${effGrade} has no step ${effStep}; paid at its top step ${cell.step}.`,
    );
    effStep = cell.step;
  }
  const scaleBasic = cell?.amount ?? 0;

  let basicSalary = scaleBasic;
  let percentBase = scaleBasic;

  const pct = clauseOf("basic_percent");
  if (pct?.value != null) {
    basicSalary = Math.round((scaleBasic * pct.value) / 100);
    notes.push(`Basic paid at ${pct.value}% — ৳${basicSalary.toLocaleString("en-BD")} of ৳${scaleBasic.toLocaleString("en-BD")}.`);
    if (verdict?.reduceDerivedAllowances) {
      percentBase = basicSalary;
      notes.push("Percentage allowances follow the reduced basic.");
    } else {
      notes.push("Percentage allowances stay on the full scale basic.");
    }
  }

  const suppressAll = Boolean(clauseOf("suppress_allowances"));
  if (suppressAll) notes.push("All allowances cancelled.");

  const suppressedHeadIds = (verdict?.clauses ?? [])
    .filter((c) => c.type === "suppress_head" && c.headId != null)
    .map((c) => c.headId as number);

  const withhold = clauseOf("withhold_increment");
  if (withhold?.value != null) {
    notes.push(
      `Increment withheld for ${withhold.value} year${withhold.value === 1 ? "" : "s"} — do not advance the step at the next annual fixation.`,
    );
  }

  return {
    grade: effGrade,
    step: effStep,
    scaleBasic,
    basicSalary,
    percentBase,
    suppressedHeadIds,
    suppressAllAllowances: suppressAll,
    notes,
  };
}

// ─── The sheet ───────────────────────────────────────────────────────────────

export type ComputeInput = {
  basicSalary: number;
  /** Null when the employee's office has no zone set. */
  zone: HouseRentZone | null;
  heads: SheetHead[];
  slabs: HouseRentSlab[];
  /**
   * What percentage-based heads are priced on. Defaults to `basicSalary`, and
   * differs only under a verdict that cuts the basic while leaving allowances
   * on the full scale figure.
   */
  percentBase?: number;
  /** Cancels every allowance. Basic and deductions stand. */
  suppressAllAllowances?: boolean;
  /** Cancels these heads by id, whichever side they sit on. */
  suppressedHeadIds?: number[];
  /** Shown on the sheet so the operator can see the verdict is in play. */
  verdictNotes?: string[];
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
  percentBase,
  suppressAllAllowances = false,
  suppressedHeadIds = [],
  verdictNotes = [],
}: ComputeInput): SalarySheet {
  const warnings: string[] = [];
  const earnings: SheetLine[] = [];
  const deductions: SheetLine[] = [];

  // Percentage heads normally price off the basic being paid; a verdict can
  // hold them on the full scale figure instead.
  const pctBase = percentBase ?? basicSalary;
  const suppressed = new Set(suppressedHeadIds);

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
        amount = Math.max(0, Math.round((pctBase * pct) / 100));
        basisNote =
          pctBase === basicSalary
            ? `${pct}% of basic`
            : `${pct}% of the full scale basic`;
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
        const rent = houseRentFor(pctBase, zone, slabs);
        if (!rent) {
          amount = 0;
          basisNote = "No rate slab covers this basic";
          warnings.push(
            `${head.nameEn} could not be computed: no ${ZONE_LABEL[zone]} slab covers a basic of ৳${pctBase.toLocaleString("en-BD")}.`,
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

    // Suppression is applied last, and keeps the line visible at zero rather
    // than dropping it — an operator has to be able to see what the verdict
    // took away.
    let suppressedBy: string | null = null;
    if (suppressed.has(head.headId)) {
      suppressedBy = "Cancelled by verdict";
    } else if (suppressAllAllowances && head.kind === "earning") {
      suppressedBy = "All allowances cancelled by verdict";
    }
    if (suppressedBy) {
      basisNote = `${suppressedBy} (was ৳${amount.toLocaleString("en-BD")})`;
      amount = 0;
    }

    const line: SheetLine = { ...head, amount, basisNote, suppressed: Boolean(suppressedBy) };
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
    verdictNotes,
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
  /**
   * Every verdict against this employee that has not been revoked, with the
   * window it bites for. Both the preview and the save route pick the one
   * covering the fixation's effective date, so a punishment that outlives a
   * fiscal year still shapes next year's annual fixation.
   */
  verdicts: DatedVerdict[];
};

export type DatedVerdict = ActiveVerdict & {
  effectiveFrom: string;
  effectiveTo: string | null;
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
  /** Set when the version exists because of a court verdict. Not hand-editable. */
  verdictId: number | null;
  /** The verdict's order number, for display. */
  verdictOrderNo: string | null;
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

/**
 * The verdict in force on a date. Used by both the fixation preview and the
 * save route, so a punishment that spans a fiscal-year boundary keeps applying
 * when next year's annual fixation is raised.
 *
 * Dates are the stored `MM-DD-YYYY` form; compared as integers to avoid pulling
 * a date library into this half.
 */
export function verdictOn(
  verdicts: DatedVerdict[],
  on: string,
): DatedVerdict | null {
  const key = (d: string) => {
    const [m, dd, y] = d.split("-").map(Number);
    return y * 10000 + m * 100 + dd;
  };
  const k = key(on);
  return (
    verdicts.find(
      (v) =>
        key(v.effectiveFrom) <= k &&
        (v.effectiveTo === null || k <= key(v.effectiveTo)),
    ) ?? null
  );
}
