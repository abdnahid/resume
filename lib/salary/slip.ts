/**
 * The salary slip for one employee for one month.
 *
 * Read entirely from what was stored at processing time — the `SalaryProcess`
 * row and the fixation version it names — never recomputed. A slip has to keep
 * showing what was actually paid, even after a later fixation supersedes the
 * one it was paid from.
 *
 * Server-only.
 */
import { prisma } from "@/lib/prisma";
import { employeesOfOffice } from "@/lib/salary/payroll";
import { orgForOffice } from "@/lib/db";
import type { OrgInfo } from "@/lib/types";

export type PayslipLine = {
  nameEn: string;
  nameBn: string;
  amount: number;
  /** How it was worked out, e.g. "45% of basic" — for the small print. */
  basis: string;
  suppressed: boolean;
};

export type Payslip = {
  /** The issuing office's letterhead — not BSTI head office's. */
  org: OrgInfo;
  employee: {
    id: string;
    nameEn: string;
    nameBn: string;
    designationBn: string;
    officeNameBn: string;
    bankAccountNo: string;
  };
  month: string;
  year: string;
  issueDate: string;
  grade: number;
  step: number | null;
  basicSalary: number;
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  grossEarning: number;
  totalDeduction: number;
  /** Net from the fixation, before arrears. */
  netSalary: number;
  arrearAmount: number;
  /** What the arrears made good, for the note on the slip. */
  arrearNote: string | null;
  /** Set when the month was paid under a court verdict. */
  verdictNote: string | null;
};

function describeBasis(
  basis: string,
  value: number | null,
  amount: number,
): { text: string; suppressed: boolean } {
  if (amount === 0 && basis !== "fixed") {
    // A head that priced to nothing is almost always a verdict suppressing it.
    return { text: "—", suppressed: true };
  }
  switch (basis) {
    case "percent_of_basic":
      return { text: value !== null ? `${value}% of basic` : "% of basic", suppressed: false };
    case "house_rent_rule":
      return { text: "Government rate", suppressed: false };
    default:
      return { text: "Fixed", suppressed: amount === 0 };
  }
}

/**
 * Null when the month was never processed for that employee, or when the caller
 * is not allowed to see it. `scopeOfficeId` pins an officeadmin to their own
 * office; `scopeEmployeeId` pins a plain employee to themselves.
 */
export async function getPayslip(
  employeeId: string,
  month: string,
  year: string,
  scope?: { officeId?: number | null; employeeId?: string },
): Promise<Payslip | null> {
  if (scope?.employeeId && scope.employeeId !== employeeId) return null;

  if (scope?.officeId != null) {
    const inScope = await prisma.employee.findFirst({
      where: { AND: [{ id: employeeId }, employeesOfOffice(scope.officeId)] },
      select: { id: true },
    });
    if (!inScope) return null;
  }

  const row = await prisma.salaryProcess.findUnique({
    where: { employeeId_month_year: { employeeId, month, year } },
    include: {
      employee: {
        select: {
          id: true,
          nameEn: true,
          nameBn: true,
          designationBn: true,
          bankAccountNo: true,
          office: { select: { nameBn: true, addressBn: true, email: true } },
          postings: {
            where: { relievedAt: null },
            take: 1,
            include: {
              orgPost: { select: { nameBn: true } },
              office: { select: { nameBn: true, addressBn: true, email: true } },
            },
          },
        },
      },
      fixation: {
        include: {
          items: { include: { head: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
          verdict: { select: { orderNo: true, summary: true } },
        },
      },
      arrears: true,
    },
  });
  if (!row) return null;

  const emp = row.employee;
  const posting = emp.postings[0] ?? null;

  const earnings: PayslipLine[] = [];
  const deductions: PayslipLine[] = [];
  for (const i of row.fixation?.items ?? []) {
    const { text, suppressed } = describeBasis(i.basis, i.value, i.amount);
    const line: PayslipLine = {
      nameEn: i.head.nameEn,
      nameBn: i.head.nameBn,
      amount: i.amount,
      basis: text,
      suppressed,
    };
    if (i.kind === "earning") earnings.push(line);
    else deductions.push(line);
  }

  const arrear = row.arrears[0] ?? null;

  // The office that actually pays them — their posting, falling back to the
  // legacy column, the same rule `employeesOfOffice()` applies.
  const payingOffice = posting?.office ?? emp.office;

  return {
    org: orgForOffice(payingOffice),
    employee: {
      id: emp.id,
      nameEn: emp.nameEn,
      nameBn: emp.nameBn,
      designationBn: posting?.orgPost?.nameBn ?? emp.designationBn ?? "",
      officeNameBn: payingOffice.nameBn,
      bankAccountNo: emp.bankAccountNo ?? "",
    },
    month: row.month,
    year: row.year,
    issueDate: row.issueDate,
    grade: row.fixation?.grade ?? 0,
    step: row.fixation?.step ?? null,
    basicSalary: row.basicSalary,
    earnings,
    deductions,
    grossEarning: row.grossEarning,
    totalDeduction: row.totalDeduction,
    // `netSalary` on the row already includes arrears; the slip shows the two
    // apart so the figure the bank transfers still reconciles.
    netSalary: row.netSalary - row.arrearAmount,
    arrearAmount: row.arrearAmount,
    arrearNote: arrear
      ? `${arrear.reason} (${arrear.fromMonth} ${arrear.fromYear} – ${arrear.toMonth} ${arrear.toYear})`
      : null,
    verdictNote: row.fixation?.verdict
      ? `${row.fixation.verdict.orderNo}: ${row.fixation.verdict.summary}`
      : null,
  };
}
