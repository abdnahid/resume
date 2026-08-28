/**
 * Payroll scoping and month sequencing — the server half shared by the salary
 * process routes and the bank advice routes.
 *
 * Two rules shape everything here:
 *
 *  - **Payroll is per office.** An office pays its own staff on its own cheque
 *    and issues its own advice, so processing, the month sequence and the advice
 *    are all scoped to one office. An officeadmin is pinned to theirs; a
 *    superadmin picks.
 *  - **Months are processed in order, and going back means undoing.** A month
 *    cannot be processed while a later one already is. To fix a mistake, delete
 *    the later months first — which is refused once their advice exists.
 *
 * Server-only.
 */
import { prisma } from "@/lib/prisma";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const MONTH_IDX: Record<string, number> = Object.fromEntries(
  MONTHS.map((m, i) => [m, i + 1]),
);

/** A comparable ordinal for a month, so sequencing never sorts strings. */
export function monthOrder(month: string, year: string | number): number {
  return Number(year) * 12 + (MONTH_IDX[month] ?? 0);
}

// ─── Which employees belong to an office ─────────────────────────────────────

/**
 * The one definition of "this office's staff", used by every screen that scopes
 * by office — the fixation list, payroll, and the bank advice.
 *
 * The **current posting** decides, not the legacy `Employee.officeId`: a
 * transfer is recorded as a posting, and the old column can be left behind. One
 * employee in this database is already in that state — `officeId` says one
 * office while their live posting says another — and without this they would
 * appear on one office's fixation screen and in another office's bank advice.
 *
 * Employees with no current posting at all fall back to `Employee.officeId`,
 * so nobody becomes invisible to every office and therefore unpayable.
 */
export function employeesOfOffice(officeId: number) {
  return {
    OR: [
      { postings: { some: { relievedAt: null, officeId } } },
      {
        AND: [
          { postings: { none: { relievedAt: null } } },
          { officeId },
        ],
      },
    ],
  };
}

// ─── Who may act on which office ─────────────────────────────────────────────

export type PayrollScope = {
  /** Null for a superadmin — every office is in reach. */
  officeId: number | null;
  /** True when the role cannot choose an office. */
  pinned: boolean;
};

/**
 * Resolve which office a user may run payroll for.
 * Returns null when the role may not run payroll at all.
 */
export async function resolvePayrollScope(
  role: string,
  username: string,
): Promise<PayrollScope | null> {
  if (role === "superadmin") return { officeId: null, pinned: false };
  if (role !== "officeadmin") return null;

  const admin = await prisma.employee.findUnique({
    where: { id: username },
    select: {
      officeId: true,
      postings: {
        where: { relievedAt: null },
        select: { officeId: true },
        take: 1,
      },
    },
  });
  if (!admin) return null;
  // Their live posting, falling back to the legacy column — the same rule
  // `employeesOfOffice()` applies to everyone else.
  const officeId = admin.postings[0]?.officeId ?? admin.officeId;
  return { officeId, pinned: true };
}

/** Offices the user may run payroll for, for the picker. */
export async function payrollOffices(scope: PayrollScope) {
  const offices = await prisma.office.findMany({
    where: scope.officeId !== null ? { id: scope.officeId } : undefined,
    select: { id: true, nameEn: true, nameBn: true },
    orderBy: { id: "asc" },
  });
  return offices;
}

// ─── The month sequence, per office ──────────────────────────────────────────

export type ProcessedMonth = {
  month: string;
  year: string;
  employeeCount: number;
  total: number;
  arrears: number;
  /** True once an advice exists — the month is then frozen. */
  hasAdvice: boolean;
  adviceId: number | null;
};

/**
 * Every month already processed for an office, newest first, with whether its
 * bank advice has been issued.
 */
export async function processedMonths(
  officeId: number,
): Promise<ProcessedMonth[]> {
  const [rows, advices] = await Promise.all([
    prisma.salaryProcess.findMany({
      where: { employee: employeesOfOffice(officeId) },
      select: { month: true, year: true, netSalary: true, arrearAmount: true },
    }),
    prisma.bankAdvice.findMany({
      where: { officeId },
      select: { id: true, month: true, year: true },
    }),
  ]);

  const byMonth = new Map<string, ProcessedMonth>();
  for (const r of rows) {
    const key = `${r.month}|${r.year}`;
    const entry = byMonth.get(key);
    if (entry) {
      entry.employeeCount++;
      entry.total += r.netSalary;
      entry.arrears += r.arrearAmount;
    } else {
      byMonth.set(key, {
        month: r.month,
        year: r.year,
        employeeCount: 1,
        total: r.netSalary,
        arrears: r.arrearAmount,
        hasAdvice: false,
        adviceId: null,
      });
    }
  }

  for (const a of advices) {
    const entry = byMonth.get(`${a.month}|${a.year}`);
    if (entry) {
      entry.hasAdvice = true;
      entry.adviceId = a.id;
    }
  }

  return [...byMonth.values()].sort(
    (a, b) => monthOrder(b.month, b.year) - monthOrder(a.month, a.year),
  );
}

/**
 * Months already processed for this office that fall *after* the one being
 * asked for. Processing is blocked while any exist — the operator must delete
 * them first, deliberately, rather than have an out-of-order month appear.
 */
export function monthsBlocking(
  months: ProcessedMonth[],
  month: string,
  year: string,
): ProcessedMonth[] {
  const target = monthOrder(month, year);
  return months
    .filter((m) => monthOrder(m.month, m.year) > target)
    .sort((a, b) => monthOrder(a.month, a.year) - monthOrder(b.month, b.year));
}

/** Whether this office has already processed the given month. */
export function alreadyProcessed(
  months: ProcessedMonth[],
  month: string,
  year: string,
): ProcessedMonth | null {
  return (
    months.find((m) => m.month === month && String(m.year) === String(year)) ??
    null
  );
}

/**
 * How many staff at each office have a fixation in force today — what a payroll
 * run would actually pay. Uses the same "in force" rule as the fixation
 * screens: not superseded, not inactive, and today inside its date range.
 */
export async function activeFixationCounts(
  officeIds: number[],
): Promise<Map<number, number>> {
  const employees = await prisma.employee.findMany({
    where: { OR: officeIds.map((id) => employeesOfOffice(id)) },
    select: {
      officeId: true,
      postings: { where: { relievedAt: null }, select: { officeId: true }, take: 1 },
      fixations: {
        where: { supersededAt: null, salaryStatus: { not: "inactive" } },
        select: { validFrom: true, validThru: true },
      },
    },
  });

  const t = new Date();
  const today =
    t.getFullYear() * 10000 + (t.getMonth() + 1) * 100 + t.getDate();
  const key = (d: string) => {
    const m = d.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    return m ? Number(m[3]) * 10000 + Number(m[1]) * 100 + Number(m[2]) : 0;
  };

  const counts = new Map<number, number>();
  for (const e of employees) {
    const inForce = e.fixations.some(
      (f) => key(f.validFrom) <= today && today <= key(f.validThru),
    );
    if (!inForce) continue;
    const office = e.postings[0]?.officeId ?? e.officeId;
    counts.set(office, (counts.get(office) ?? 0) + 1);
  }
  return counts;
}
