/**
 * Turning a court verdict into money.
 *
 * The design goal here was to avoid a "replay history" engine. Two facts make
 * that unnecessary:
 *
 *  - Fixation is already versioned, so a verdict is just another reason to
 *    raise a version — the same machinery a mid-year increment uses.
 *  - A verdict-derived version records the version it displaced
 *    (`baselineFixationId`). So the pay withheld in a month is exactly
 *    `baseline.netSalary - process.netSalary`, and an arrear is a sum of
 *    differences rather than a recomputation of the past.
 *
 * The worked example this was built against:
 *
 *   1. Court cancels all allowances for one year from 1 September.
 *      `imposeVerdict` raises a punished version for that window, and a
 *      restoring version for the day after it ends. Salary processing needs no
 *      knowledge of verdicts at all — it just pays the version in force.
 *   2. Three months later the employee wins an appeal and arrears are ordered.
 *      `revokeVerdict` closes the punished version, raises a restoring version
 *      from the revocation date, and totals the difference across exactly the
 *      months that were paid under the punished version — three, here.
 *   3. The next month processed picks the arrear up and pays it. The bank
 *      advice follows, because it has always just summed net pay.
 *
 * Server-only.
 */
import { prisma } from "@/lib/prisma";
import {
  applyVerdict,
  computeSheet,
  headsToSheetInputs,
  type ActiveVerdict,
  type SalarySheet,
} from "@/lib/salary/compute";
import {
  dateKey,
  dayBefore,
  lastDayOfMonth,
  nextDay,
  todayStored,
} from "@/lib/salary/dates";
import { getActiveScale, getFixationContext } from "@/lib/salary/queries";

// ─── Loading ─────────────────────────────────────────────────────────────────

export async function loadVerdict(verdictId: number) {
  return prisma.caseVerdict.findUnique({
    where: { id: verdictId },
    include: { clauses: true, case: true },
  });
}

type VerdictRow = NonNullable<Awaited<ReturnType<typeof loadVerdict>>>;

function toActive(v: VerdictRow): ActiveVerdict {
  return {
    id: v.id,
    orderNo: v.orderNo,
    summary: v.summary,
    reduceDerivedAllowances: v.reduceDerivedAllowances,
    clauses: v.clauses.map((c) => ({
      type: c.type,
      value: c.value,
      headId: c.headId,
    })),
  };
}

// ─── Building a version's sheet ──────────────────────────────────────────────

type Baseline = {
  id: number;
  grade: number;
  step: number | null;
  basicSalary: number;
  validFrom: string;
  validThru: string;
  items: { headId: number; value: number | null }[];
};

/**
 * Price a sheet for an employee at a given grade/step, optionally under a
 * verdict. Uses the same `computeSheet()` as the fixation form, so a punished
 * sheet and an ordinary one can never diverge.
 */
async function priceSheet(
  employeeId: string,
  baseline: Baseline,
  verdict: ActiveVerdict | null,
): Promise<{ sheet: SalarySheet; grade: number; step: number; scaleId: number | null }> {
  const [context, scale] = await Promise.all([
    getFixationContext(employeeId),
    getActiveScale(),
  ]);
  if (!context) throw new Error("Employee not found");

  const steps = scale?.steps ?? [];
  const effect = applyVerdict(
    baseline.grade,
    baseline.step ?? 0,
    steps,
    verdict,
  );

  // A pre-grid fixation may hold a basic that is not on any rung; keep paying
  // it rather than silently moving the employee onto the nearest step.
  const scaleBasic = effect.scaleBasic || baseline.basicSalary;
  const basic = verdict ? effect.basicSalary || scaleBasic : scaleBasic;

  const sheet = computeSheet({
    basicSalary: basic,
    percentBase: verdict ? effect.percentBase || scaleBasic : scaleBasic,
    zone: context.zone,
    heads: headsToSheetInputs(context.heads, baseline.items),
    slabs: context.slabs,
    suppressAllAllowances: effect.suppressAllAllowances,
    suppressedHeadIds: effect.suppressedHeadIds,
    verdictNotes: effect.notes,
  });

  return { sheet, grade: effect.grade, step: effect.step, scaleId: scale?.id ?? null };
}

/** The version in force on a date, ignoring superseded and inactive rows. */
async function versionInForceOn(employeeId: string, on: string) {
  const rows = await prisma.salaryFixation.findMany({
    where: { employeeId, supersededAt: null, salaryStatus: { not: "inactive" } },
    include: { items: true },
  });
  const k = dateKey(on);
  return (
    rows
      .filter((f) => dateKey(f.validFrom) <= k && k <= dateKey(f.validThru))
      .sort((a, b) => dateKey(b.validFrom) - dateKey(a.validFrom) || b.id - a.id)[0] ?? null
  );
}

function asBaseline(f: {
  id: number;
  grade: number;
  step: number | null;
  basicSalary: number;
  validFrom: string;
  validThru: string;
  items: { headId: number; value: number | null }[];
}): Baseline {
  return {
    id: f.id,
    grade: f.grade,
    step: f.step,
    basicSalary: f.basicSalary,
    validFrom: f.validFrom,
    validThru: f.validThru,
    items: f.items.map((i) => ({ headId: i.headId, value: i.value })),
  };
}

function linesOf(sheet: SalarySheet) {
  return [...sheet.earnings, ...sheet.deductions].map((l) => ({
    headId: l.headId,
    kind: l.kind,
    basis: l.basis,
    value: l.basis === "house_rent_rule" ? null : (l.value ?? 0),
    amount: l.amount,
    sortOrder: l.sortOrder,
  }));
}

// ─── Imposing ────────────────────────────────────────────────────────────────

export type ImposeResult = {
  punishedFixationId: number;
  restoringFixationId: number | null;
  netBefore: number;
  netAfter: number;
  notes: string[];
};

/**
 * Apply a verdict to an employee's pay by raising fixation versions.
 *
 * Refuses if a month covered by the window has already been processed — a
 * disbursed salary cannot be retroactively reduced, and the order needs a later
 * effective date (or an arrear-style recovery, which is an ordinary deduction
 * head, not a verdict clause).
 */
export async function imposeVerdict(
  verdictId: number,
  actor: string | null,
): Promise<ImposeResult> {
  const verdict = await loadVerdict(verdictId);
  if (!verdict) throw new Error("Verdict not found");
  if (verdict.revokedOn) throw new Error("This verdict has been revoked.");

  const employeeId = verdict.case.employeeId;
  const from = verdict.effectiveFrom;

  const current = await versionInForceOn(employeeId, from);
  if (!current) {
    throw new Error(
      `This employee has no salary fixation covering ${from}, so there is nothing for the verdict to modify. Set a fixation first.`,
    );
  }
  if (current.verdictId) {
    throw new Error(
      "Another verdict is already in force for this period. Revoke it before imposing a new one.",
    );
  }

  const alreadyPaid = await prisma.salaryProcess.findFirst({
    where: { employeeId, fixationId: current.id },
    orderBy: { id: "desc" },
  });
  if (alreadyPaid) {
    const end = lastDayOfMonth(alreadyPaid.month, alreadyPaid.year);
    if (end && dateKey(end) >= dateKey(from)) {
      throw new Error(
        `${alreadyPaid.month} ${alreadyPaid.year} has already been paid. A verdict cannot reduce a salary already disbursed — use a later effective date.`,
      );
    }
  }

  const baseline = asBaseline(current);
  const active = toActive(verdict);
  const punished = await priceSheet(employeeId, baseline, active);

  // The punished window ends where the verdict says, or where the version it
  // displaced would have ended.
  const windowEnd =
    verdict.effectiveTo && dateKey(verdict.effectiveTo) < dateKey(current.validThru)
      ? verdict.effectiveTo
      : current.validThru;

  const restoreNeeded =
    verdict.effectiveTo !== null &&
    dateKey(windowEnd) < dateKey(current.validThru);

  const restored = restoreNeeded
    ? await priceSheet(employeeId, baseline, null)
    : null;

  return prisma.$transaction(async (tx) => {
    await tx.salaryFixation.update({
      where: { id: current.id },
      data: {
        validThru:
          dateKey(current.validFrom) < dateKey(from)
            ? dayBefore(from)
            : current.validThru,
        supersededAt: new Date(),
      },
    });

    const punishedRow = await tx.salaryFixation.create({
      data: {
        employeeId,
        grade: punished.grade,
        step: punished.step,
        basicSalary: punished.sheet.basicSalary,
        validFrom: from,
        validThru: windowEnd,
        reason: "punishment",
        note: `${verdict.orderNo}: ${verdict.summary}`,
        grossEarning: punished.sheet.grossEarning,
        totalDeduction: punished.sheet.totalDeduction,
        netSalary: punished.sheet.netSalary,
        scaleId: punished.scaleId,
        verdictId: verdict.id,
        baselineFixationId: current.id,
        createdBy: actor,
        items: { create: linesOf(punished.sheet) },
      },
    });

    let restoringId: number | null = null;
    if (restored) {
      const row = await tx.salaryFixation.create({
        data: {
          employeeId,
          grade: baseline.grade,
          step: baseline.step,
          basicSalary: restored.sheet.basicSalary,
          validFrom: nextDay(windowEnd),
          validThru: current.validThru,
          reason: "correction",
          note: `Normal pay resumes after ${verdict.orderNo}`,
          grossEarning: restored.sheet.grossEarning,
          totalDeduction: restored.sheet.totalDeduction,
          netSalary: restored.sheet.netSalary,
          scaleId: restored.scaleId,
          createdBy: actor,
          items: { create: linesOf(restored.sheet) },
        },
      });
      restoringId = row.id;
    }

    return {
      punishedFixationId: punishedRow.id,
      restoringFixationId: restoringId,
      netBefore: current.netSalary,
      netAfter: punished.sheet.netSalary,
      notes: punished.sheet.verdictNotes,
    };
  });
}

// ─── Revoking, and arrears ───────────────────────────────────────────────────

export type RevokeResult = {
  restoredFixationId: number | null;
  arrearAmount: number;
  arrearMonths: number;
};

/**
 * Lift a verdict from `revokedOn`, and — where the order directs it — total the
 * pay it withheld so the next processed month makes it good.
 *
 * The arrear is the sum, over exactly the months paid under the punished
 * version, of what the displaced version would have paid less what was paid.
 * No month is recomputed; the two figures are both already stored.
 */
export async function revokeVerdict(
  verdictId: number,
  opts: { revokedOn: string; reason: string; arrearsOrdered: boolean },
  actor: string | null,
): Promise<RevokeResult> {
  const verdict = await loadVerdict(verdictId);
  if (!verdict) throw new Error("Verdict not found");
  if (verdict.revokedOn) throw new Error("This verdict is already revoked.");

  const employeeId = verdict.case.employeeId;

  const punished = await prisma.salaryFixation.findFirst({
    where: { employeeId, verdictId: verdict.id },
    include: { items: true, baselineFixation: { include: { items: true } } },
    orderBy: { id: "desc" },
  });
  if (!punished) {
    // The verdict was recorded but never imposed on pay — nothing to undo.
    await prisma.caseVerdict.update({
      where: { id: verdict.id },
      data: {
        revokedOn: opts.revokedOn,
        revokedReason: opts.reason,
        arrearsOrdered: opts.arrearsOrdered,
      },
    });
    return { restoredFixationId: null, arrearAmount: 0, arrearMonths: 0 };
  }

  const baseline = punished.baselineFixation;

  // ── Arrears: a sum of differences over the months actually paid ──
  const paidMonths = await prisma.salaryProcess.findMany({
    where: { fixationId: punished.id },
    orderBy: { id: "asc" },
  });
  let arrearAmount = 0;
  if (opts.arrearsOrdered && baseline) {
    for (const m of paidMonths) {
      arrearAmount += Math.max(0, baseline.netSalary - m.netSalary);
    }
  }

  // ── Restore normal pay from the revocation date ──
  const restored =
    baseline && dateKey(opts.revokedOn) <= dateKey(punished.validThru)
      ? await priceSheet(employeeId, asBaseline(baseline), null)
      : null;

  return prisma.$transaction(async (tx) => {
    await tx.caseVerdict.update({
      where: { id: verdict.id },
      data: {
        revokedOn: opts.revokedOn,
        revokedReason: opts.reason,
        arrearsOrdered: opts.arrearsOrdered,
      },
    });

    await tx.salaryFixation.update({
      where: { id: punished.id },
      data: {
        validThru:
          dateKey(punished.validFrom) < dateKey(opts.revokedOn)
            ? dayBefore(opts.revokedOn)
            : punished.validThru,
        supersededAt: new Date(),
      },
    });

    let restoredId: number | null = null;
    if (restored && baseline) {
      const row = await tx.salaryFixation.create({
        data: {
          employeeId,
          grade: baseline.grade,
          step: baseline.step,
          basicSalary: restored.sheet.basicSalary,
          validFrom: opts.revokedOn,
          validThru: punished.validThru,
          reason: "correction",
          note: `${verdict.orderNo} revoked: ${opts.reason}`,
          grossEarning: restored.sheet.grossEarning,
          totalDeduction: restored.sheet.totalDeduction,
          netSalary: restored.sheet.netSalary,
          scaleId: restored.scaleId,
          createdBy: actor,
          items: { create: linesOf(restored.sheet) },
        },
      });
      restoredId = row.id;
    }

    if (arrearAmount > 0) {
      const first = paidMonths[0];
      const last = paidMonths[paidMonths.length - 1];
      await tx.salaryArrear.create({
        data: {
          employeeId,
          amount: arrearAmount,
          reason: `Arrears restored on revocation of ${verdict.orderNo}: ${opts.reason}`,
          fromMonth: first.month,
          fromYear: first.year,
          toMonth: last.month,
          toYear: last.year,
          verdictId: verdict.id,
          createdBy: actor,
        },
      });
    }

    return {
      restoredFixationId: restoredId,
      arrearAmount,
      arrearMonths: arrearAmount > 0 ? paidMonths.length : 0,
    };
  });
}

/** The verdict in force for an employee on a date, if any. */
export async function activeVerdictFor(
  employeeId: string,
  on: string = todayStored(),
): Promise<ActiveVerdict | null> {
  const rows = await prisma.caseVerdict.findMany({
    where: { case: { employeeId }, revokedOn: null },
    include: { clauses: true, case: true },
  });
  const k = dateKey(on);
  const hit = rows.find(
    (v) =>
      dateKey(v.effectiveFrom) <= k &&
      (v.effectiveTo === null || k <= dateKey(v.effectiveTo)),
  );
  return hit ? toActive(hit) : null;
}
