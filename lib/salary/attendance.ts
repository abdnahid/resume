/**
 * The attendance register for daily-basis staff.
 *
 * Server-only. Days worked live here rather than on `SalaryProcess`, so they
 * can be entered through the month and corrected afterwards without undoing a
 * pay run — which was impossible once the bank advice had been issued.
 */
import { prisma } from "@/lib/prisma";
import { employeesOfOffice } from "@/lib/salary/payroll";
import { MAX_PAID_DAYS, rateFor } from "@/lib/salary/daily";
import { getDailyRates } from "@/lib/salary/queries";
import { lastDayOfMonth } from "@/lib/salary/dates";

export type AttendanceRow = {
  employeeId: string;
  nameEn: string;
  nameBn: string;
  designationBn: string | null;
  /** Null until somebody records it — the pay run refuses on null. */
  daysWorked: number | null;
  note: string | null;
  recordedBy: string | null;
  updatedAt: string | null;
  /** The office zone rate; null when the office has no zone set. */
  dailyRate: number | null;
  /** True once this month has been paid — the register then reads as history. */
  processed: boolean;
};

export type AttendanceSheet = {
  officeId: number;
  officeName: string;
  month: string;
  year: string;
  maxDays: number;
  rows: AttendanceRow[];
};

/**
 * Every daily-basis worker at an office for a month, with whatever attendance
 * has been recorded so far.
 */
export async function getAttendanceSheet(
  officeId: number,
  month: string,
  year: string,
): Promise<AttendanceSheet | null> {
  const office = await prisma.office.findUnique({
    where: { id: officeId },
    select: { id: true, nameEn: true },
  });
  if (!office) return null;

  const monthEnd = lastDayOfMonth(month, year);

  const [staff, records, rates, processed] = await Promise.all([
    prisma.employee.findMany({
      where: { AND: [employeesOfOffice(officeId), { category: "daily_basis" }] },
      select: {
        id: true,
        nameEn: true,
        nameBn: true,
        designationBn: true,
        office: { select: { houseRentZone: true } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.dailyAttendance.findMany({ where: { month, year } }),
    getDailyRates(monthEnd ?? undefined),
    prisma.salaryProcess.findMany({
      where: { month, year },
      select: { employeeId: true },
    }),
  ]);

  const byEmployee = new Map(records.map((r) => [r.employeeId, r]));
  const paid = new Set(processed.map((p) => p.employeeId));

  return {
    officeId: office.id,
    officeName: office.nameEn,
    month,
    year,
    maxDays: MAX_PAID_DAYS,
    rows: staff.map((s) => {
      const rec = byEmployee.get(s.id);
      return {
        employeeId: s.id,
        nameEn: s.nameEn,
        nameBn: s.nameBn,
        designationBn: s.designationBn,
        daysWorked: rec?.daysWorked ?? null,
        note: rec?.note ?? null,
        recordedBy: rec?.recordedBy ?? null,
        updatedAt: rec?.updatedAt ? rec.updatedAt.toISOString() : null,
        dailyRate: rateFor(rates, s.office.houseRentZone),
        processed: paid.has(s.id),
      };
    }),
  };
}

/** Days recorded for a month, keyed by employee — what the pay run reads. */
export async function attendanceFor(
  month: string,
  year: string,
  employeeIds: string[],
): Promise<Map<string, number>> {
  const rows = await prisma.dailyAttendance.findMany({
    where: { month, year, employeeId: { in: employeeIds } },
    select: { employeeId: true, daysWorked: true },
  });
  return new Map(rows.map((r) => [r.employeeId, r.daysWorked]));
}
