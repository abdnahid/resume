/**
 * Case management — the guard and the read side.
 *
 * Cases are handled by a central legal cell, so a `case_officer` reaches every
 * office rather than being scoped to one like an officeadmin. A superadmin can
 * do the same. Nobody else may see a case at all: a disciplinary record is more
 * sensitive than a salary record, and salary admins have no business in it.
 *
 * Server-only.
 */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { VerdictClauseType } from "@/lib/salary/compute";

export const CASE_FORUMS = [
  "departmental",
  "administrative_tribunal",
  "civil_court",
  "criminal_court",
  "high_court",
  "appellate_division",
] as const;

export const CASE_STATUSES = [
  "open",
  "under_trial",
  "verdict_given",
  "under_appeal",
  "closed",
] as const;

export const CLAUSE_TYPES: VerdictClauseType[] = [
  "reduce_increments",
  "withhold_increment",
  "demote_grade",
  "basic_percent",
  "suppress_allowances",
  "suppress_head",
];

export const FORUM_LABEL: Record<string, string> = {
  departmental: "Departmental",
  administrative_tribunal: "Administrative Tribunal",
  civil_court: "Civil Court",
  criminal_court: "Criminal Court",
  high_court: "High Court Division",
  appellate_division: "Appellate Division",
};

export const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  under_trial: "Under trial",
  verdict_given: "Verdict given",
  under_appeal: "Under appeal",
  closed: "Closed",
};

export type CaseGate =
  | { ok: false; response: NextResponse }
  | { ok: true; username: string; role: string };

/** Superadmin or case_officer, and INTERNAL. Nobody else. */
export async function requireCaseHandler(): Promise<CaseGate> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (
    !session ||
    (session.user as { accountType?: string }).accountType !== "INTERNAL"
  ) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  const role = (session.user as { role?: string }).role ?? "employee";
  if (role !== "superadmin" && role !== "case_officer") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Only a case officer or a superadmin can work on cases." },
        { status: 403 },
      ),
    };
  }
  return { ok: true, username: session.user.username ?? "", role };
}

// ─── Reads ───────────────────────────────────────────────────────────────────

const CASE_INCLUDE = {
  employee: { select: { id: true, nameEn: true, nameBn: true, designationBn: true } },
  verdicts: {
    include: { clauses: { include: { head: { select: { nameEn: true } } } } },
    orderBy: { id: "desc" as const },
  },
};

export async function getCases(filter?: { employeeId?: string; status?: string }) {
  const rows = await prisma.employeeCase.findMany({
    where: {
      ...(filter?.employeeId ? { employeeId: filter.employeeId } : {}),
      ...(filter?.status ? { status: filter.status as never } : {}),
    },
    include: CASE_INCLUDE,
    orderBy: { id: "desc" },
  });
  return rows.map(serialiseCase);
}

export async function getCase(id: number) {
  const row = await prisma.employeeCase.findUnique({
    where: { id },
    include: CASE_INCLUDE,
  });
  return row ? serialiseCase(row) : null;
}

type CaseRow = NonNullable<Awaited<ReturnType<typeof prisma.employeeCase.findUnique>>> & {
  employee: { id: string; nameEn: string; nameBn: string; designationBn: string | null };
  verdicts: {
    id: number;
    orderNo: string;
    verdictDate: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    summary: string;
    reduceDerivedAllowances: boolean;
    revokedOn: string | null;
    revokedReason: string | null;
    arrearsOrdered: boolean;
    clauses: {
      id: number;
      type: VerdictClauseType;
      value: number | null;
      headId: number | null;
      head: { nameEn: string } | null;
    }[];
  }[];
};

export type CaseRecord = ReturnType<typeof serialiseCase>;

function serialiseCase(row: CaseRow) {
  return {
    id: row.id,
    caseNo: row.caseNo,
    title: row.title,
    forum: row.forum as string,
    status: row.status as string,
    filedOn: row.filedOn,
    closedOn: row.closedOn,
    summary: row.summary,
    employee: {
      id: row.employee.id,
      nameEn: row.employee.nameEn,
      nameBn: row.employee.nameBn,
      designationBn: row.employee.designationBn,
    },
    verdicts: row.verdicts.map((v) => ({
      id: v.id,
      orderNo: v.orderNo,
      verdictDate: v.verdictDate,
      effectiveFrom: v.effectiveFrom,
      effectiveTo: v.effectiveTo,
      summary: v.summary,
      reduceDerivedAllowances: v.reduceDerivedAllowances,
      revokedOn: v.revokedOn,
      revokedReason: v.revokedReason,
      arrearsOrdered: v.arrearsOrdered,
      clauses: v.clauses.map((c) => ({
        id: c.id,
        type: c.type,
        value: c.value,
        headId: c.headId,
        headName: c.head?.nameEn ?? null,
      })),
    })),
  };
}

/** Outstanding arrears for an employee — shown on the case screen. */
export async function getArrears(employeeId: string) {
  const rows = await prisma.salaryArrear.findMany({
    where: { employeeId },
    orderBy: { id: "desc" },
  });
  return rows.map((a) => ({
    id: a.id,
    amount: a.amount,
    reason: a.reason,
    period: `${a.fromMonth} ${a.fromYear} – ${a.toMonth} ${a.toYear}`,
    paidAt: a.paidAt ? a.paidAt.toISOString() : null,
  }));
}
