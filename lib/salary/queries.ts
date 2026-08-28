/**
 * Server-side salary queries — the Prisma half of `lib/salary/` (D9).
 *
 * Never import this from a client component. `lib/salary/compute.ts` and
 * `lib/salary/dates.ts` are the halves that are safe in the browser; this one
 * pulls `pg` in with it.
 */
import { prisma } from "@/lib/prisma";
import {
  covers,
  dateKey,
  todayStored,
} from "@/lib/salary/dates";
import type {
  FixationContext,
  FixationItemRecord,
  FixationReason,
  FixationVersion,
  HouseRentSlab,
  SalaryHeadRecord,
  ScaleStep,
} from "@/lib/salary/compute";

// ─── Pay scale ───────────────────────────────────────────────────────────────

export type ActiveScale = {
  id: number;
  code: string;
  nameEn: string;
  nameBn: string;
  verified: boolean;
  incrementNote: string | null;
  steps: ScaleStep[];
  slabs: HouseRentSlab[];
};

/**
 * The scale new fixations are made against. Null when none is marked active —
 * `npm run seed:salary` creates NPS-2015 and marks it so.
 */
export async function getActiveScale(): Promise<ActiveScale | null> {
  const scale = await prisma.payScale.findFirst({
    where: { isActive: true },
    include: {
      steps: { orderBy: [{ grade: "asc" }, { step: "asc" }] },
      houseRentRules: { orderBy: [{ zone: "asc" }, { minBasic: "asc" }] },
    },
  });
  if (!scale) return null;

  return {
    id: scale.id,
    code: scale.code,
    nameEn: scale.nameEn,
    nameBn: scale.nameBn,
    verified: scale.verified,
    incrementNote: scale.incrementNote,
    steps: scale.steps.map((s) => ({
      grade: s.grade,
      step: s.step,
      amount: s.amount,
    })),
    slabs: scale.houseRentRules.map((r) => ({
      zone: r.zone,
      minBasic: r.minBasic,
      maxBasic: r.maxBasic,
      percent: r.percent,
      minAmount: r.minAmount,
    })),
  };
}

/** Every scale, newest effective date first — for the scale list screen. */
export async function getPayScales() {
  const scales = await prisma.payScale.findMany({
    orderBy: { effectiveFrom: "desc" },
    include: { _count: { select: { steps: true, fixations: true } } },
  });
  return scales.map((s) => ({
    id: s.id,
    code: s.code,
    nameEn: s.nameEn,
    nameBn: s.nameBn,
    effectiveFrom: s.effectiveFrom,
    effectiveTo: s.effectiveTo,
    isActive: s.isActive,
    verified: s.verified,
    incrementNote: s.incrementNote,
    stepCount: s._count.steps,
    fixationCount: s._count.fixations,
  }));
}

// ─── Head catalogue ──────────────────────────────────────────────────────────

export async function getSalaryHeads(options?: {
  activeOnly?: boolean;
}): Promise<SalaryHeadRecord[]> {
  const heads = await prisma.salaryHead.findMany({
    where: options?.activeOnly ? { isActive: true } : undefined,
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    include: { _count: { select: { items: true } } },
  });
  return heads.map((h) => ({
    id: h.id,
    code: h.code,
    nameEn: h.nameEn,
    nameBn: h.nameBn,
    kind: h.kind,
    basis: h.basis,
    defaultValue: h.defaultValue,
    isDefault: h.isDefault,
    isActive: h.isActive,
    sortOrder: h.sortOrder,
    note: h.note,
    usageCount: h._count.items,
  }));
}

// ─── Fixations ───────────────────────────────────────────────────────────────

// Not `as const` — Prisma rejects the readonly tuple that produces for orderBy.
const FIXATION_INCLUDE = {
  items: {
    include: { head: true },
    orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
  },
  _count: { select: { processes: true } },
};

type FixationRow = {
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
  supersededAt: Date | null;
  createdAt: Date;
  createdBy: string | null;
  items: {
    headId: number;
    kind: "earning" | "deduction";
    basis: "fixed" | "percent_of_basic" | "house_rent_rule";
    value: number | null;
    amount: number;
    sortOrder: number;
    head: { code: string; nameEn: string; nameBn: string };
  }[];
  _count: { processes: number };
};

/**
 * `expired` and `not_found` are computed, never stored — a row past its
 * valid-through date reads as expired without anyone having to run a job.
 */
export function effectiveStatus(
  validThru: string,
  stored: string,
  supersededAt: Date | null,
): "active" | "expired" | "inactive" {
  if (stored === "inactive") return "inactive";
  if (supersededAt) return "expired";
  if (dateKey(validThru) < dateKey(todayStored())) return "expired";
  return "active";
}

function mapVersion(f: FixationRow): FixationVersion {
  const items: FixationItemRecord[] = f.items.map((i) => ({
    headId: i.headId,
    code: i.head.code,
    nameEn: i.head.nameEn,
    nameBn: i.head.nameBn,
    kind: i.kind,
    basis: i.basis,
    value: i.value,
    amount: i.amount,
    sortOrder: i.sortOrder,
  }));

  return {
    id: f.id,
    grade: f.grade,
    step: f.step,
    basicSalary: f.basicSalary,
    validFrom: f.validFrom,
    validThru: f.validThru,
    salaryStatus: effectiveStatus(f.validThru, f.salaryStatus, f.supersededAt),
    reason: f.reason,
    note: f.note,
    grossEarning: f.grossEarning,
    totalDeduction: f.totalDeduction,
    netSalary: f.netSalary,
    supersededAt: f.supersededAt ? f.supersededAt.toISOString() : null,
    createdAt: f.createdAt.toISOString(),
    createdBy: f.createdBy,
    items,
    isLocked: f._count.processes > 0,
  };
}

/** Every version for one employee, most recently effective first. */
export async function getEmployeeFixations(
  employeeId: string,
): Promise<FixationVersion[]> {
  const rows = await prisma.salaryFixation.findMany({
    where: { employeeId },
    include: FIXATION_INCLUDE,
  });
  return rows
    .map((r) => mapVersion(r as unknown as FixationRow))
    .sort((a, b) => dateKey(b.validFrom) - dateKey(a.validFrom) || b.id - a.id);
}

/**
 * The version in force on `on` (default today): not superseded, not inactive,
 * and whose date range covers the day. Null when the employee has none.
 */
export function versionInForce(
  versions: FixationVersion[],
  on: string = todayStored(),
): FixationVersion | null {
  return (
    versions.find(
      (v) =>
        !v.supersededAt &&
        v.salaryStatus !== "inactive" &&
        covers(v.validFrom, v.validThru, on),
    ) ?? null
  );
}

/** Everything the fixation form needs, for one employee. */
export async function getFixationContext(
  employeeId: string,
): Promise<FixationContext | null> {
  const [employee, scale, heads] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: { office: { select: { nameEn: true, houseRentZone: true } } },
    }),
    getActiveScale(),
    getSalaryHeads({ activeOnly: true }),
  ]);
  if (!employee) return null;

  return {
    scale: scale
      ? {
          id: scale.id,
          code: scale.code,
          nameEn: scale.nameEn,
          nameBn: scale.nameBn,
          verified: scale.verified,
          incrementNote: scale.incrementNote,
        }
      : null,
    steps: scale?.steps ?? [],
    slabs: scale?.slabs ?? [],
    heads,
    zone: employee.office?.houseRentZone ?? null,
    officeName: employee.office?.nameEn ?? "",
  };
}
