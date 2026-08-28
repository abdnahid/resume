import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { covers, dateKey, lastDayOfMonth, todayStored } from "@/lib/salary/dates";
import {
  monthsBlocking,
  processedMonths,
  resolvePayrollScope,
  type PayrollScope,
} from "@/lib/salary/payroll";

/**
 * Process one month's salary, for one employee or for everyone.
 *
 * The month is paid from the fixation version **in force on the last day of
 * that month** — not from whatever version happens to be current now. That is
 * what makes back-processing an earlier month safe after a mid-year increment
 * has already been recorded: July still pays July's structure.
 *
 * Totals are snapshotted onto `SalaryProcess` rather than derived on read,
 * because the bank advice is generated from them and has to keep showing what
 * was actually paid. The `fixationId` link is kept so a payslip can still be
 * broken down line by line afterwards.
 */

type FixationRow = {
  id: number;
  basicSalary: number;
  grossEarning: number;
  totalDeduction: number;
  netSalary: number;
  validFrom: string;
  validThru: string;
  salaryStatus: string;
  supersededAt: Date | null;
};

/**
 * The version that decides this month's pay: covers the month-end, is not
 * inactive, and — among several — the one that started most recently.
 *
 * `supersededAt` is deliberately *not* a disqualifier. A version superseded
 * last week was still the one in force for a month that ended before it was
 * displaced, and that month must keep paying what it actually paid.
 */
function versionForMonthEnd(
  rows: FixationRow[],
  monthEnd: string,
): FixationRow | null {
  const candidates = rows
    .filter(
      (f) =>
        f.salaryStatus !== "inactive" &&
        covers(f.validFrom, f.validThru, monthEnd),
    )
    .sort((a, b) => dateKey(b.validFrom) - dateKey(a.validFrom) || b.id - a.id);
  return candidates[0] ?? null;
}

function todayIssueDate() {
  return todayStored();
}

/** What a fixation contributes to a `SalaryProcess` row. */
function processData(f: FixationRow) {
  return {
    fixationId: f.id,
    basicSalary: f.basicSalary,
    grossEarning: f.grossEarning,
    totalDeduction: f.totalDeduction,
    netSalary: f.netSalary,
  };
}

/**
 * Write one month's pay, settling any arrears outstanding for the employee.
 *
 * Arrears are pay a verdict withheld that a later order made good. They are
 * added on top of the fixation's net and stamped as paid in the same
 * transaction, so an arrear can never be paid twice or silently dropped. The
 * bank advice needs no changes — it has always summed `netSalary`.
 */
async function payMonth(
  employeeId: string,
  fixation: FixationRow,
  month: string,
  year: string,
  issueDate: string,
): Promise<{ arrearAmount: number }> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.salaryProcess.findUnique({
      where: { employeeId_month_year: { employeeId, month, year } },
      select: { id: true, arrearAmount: true },
    });
    // Already processed — re-running a month must not pay arrears twice.
    if (existing) return { arrearAmount: existing.arrearAmount };

    const pending = await tx.salaryArrear.findMany({
      where: { employeeId, paidAt: null },
    });
    const arrearAmount = pending.reduce((sum, a) => sum + a.amount, 0);
    const base = processData(fixation);

    const row = await tx.salaryProcess.create({
      data: {
        employeeId,
        issueDate,
        month,
        year,
        ...base,
        arrearAmount,
        netSalary: base.netSalary + arrearAmount,
      },
    });

    if (pending.length) {
      await tx.salaryArrear.updateMany({
        where: { id: { in: pending.map((a) => a.id) } },
        data: { paidAt: new Date(), paidInProcessId: row.id },
      });
    }
    return { arrearAmount };
  });
}

type Gate =
  | { ok: false; response: NextResponse }
  | { ok: true; role: string; username: string; scope: PayrollScope };

/**
 * Salary processing writes money, so it is superadmin or officeadmin only.
 *
 * This check used to be `accountType === "INTERNAL"` alone, which let any
 * member of staff — including a plain `employee` — process payroll for the
 * whole institute.
 */
async function gate(): Promise<Gate> {
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
  const username = session.user.username ?? "";
  const scope = await resolvePayrollScope(role, username);
  if (!scope) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Only an administrator can process salary." },
        { status: 403 },
      ),
    };
  }
  return { ok: true, role, username, scope };
}

/**
 * Which office this request is for. An officeadmin is pinned to their own
 * whatever they send; a superadmin must name one, because payroll and the bank
 * advice that follows it are both per office.
 */
function resolveOffice(
  scope: PayrollScope,
  requested: unknown,
): { ok: true; officeId: number } | { ok: false; error: string } {
  if (scope.pinned) return { ok: true, officeId: scope.officeId! };

  const n = Number(requested);
  if (!Number.isInteger(n)) {
    return { ok: false, error: "Choose which office to process." };
  }
  return { ok: true, officeId: n };
}

export async function POST(req: Request) {
  const g = await gate();
  if (!g.ok) return g.response;

  const { month, year, employeeId, officeId } = await req.json();

  if (!month || !year) {
    return NextResponse.json(
      { error: "month and year are required" },
      { status: 400 },
    );
  }

  const monthEnd = lastDayOfMonth(String(month), String(year));
  if (!monthEnd) {
    return NextResponse.json(
      { error: `"${month} ${year}" is not a month we recognise.` },
      { status: 400 },
    );
  }

  const office = resolveOffice(g.scope, officeId);
  if (!office.ok) return NextResponse.json({ error: office.error }, { status: 400 });

  const issueDate = todayIssueDate();
  const months = await processedMonths(office.officeId);

  // ── Sequence: never leave a gap behind a processed month ────────────────
  const blocking = monthsBlocking(months, String(month), String(year));
  if (blocking.length) {
    const names = blocking.map((b) => `${b.month} ${b.year}`).join(", ");
    return NextResponse.json(
      {
        error: `${names} ${blocking.length === 1 ? "has" : "have"} already been processed for this office. Delete ${blocking.length === 1 ? "it" : "them"} before processing ${month} ${year}.`,
        blocking: blocking.map((b) => ({ month: b.month, year: b.year, hasAdvice: b.hasAdvice })),
      },
      { status: 409 },
    );
  }

  // ── Single-employee mode ───────────────────────────────────────────────────
  if (employeeId) {
    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { fixations: true },
    });

    if (!emp || emp.officeId !== office.officeId) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    if (!emp.fixations.length) {
      return NextResponse.json(
        { error: "No fixation record found. Set up salary fixation first." },
        { status: 400 },
      );
    }

    const fixation = versionForMonthEnd(emp.fixations, monthEnd);
    if (!fixation) {
      return NextResponse.json(
        {
          error: `No fixation was in force at the end of ${month} ${year}. Set a fixation covering that month first.`,
        },
        { status: 400 },
      );
    }

    const { arrearAmount } = await payMonth(emp.id, fixation, month, year, issueDate);
    return NextResponse.json({ processed: 1, skipped: 0, arrearAmount, month, year });
  }

  // ── Bulk mode, scoped to the office ────────────────────────────────────────
  const employees = await prisma.employee.findMany({
    where: { officeId: office.officeId },
    include: { fixations: true },
  });

  let processed = 0;
  let arrearsPaid = 0;
  const skipped: { id: string; name: string; reason: string }[] = [];

  for (const emp of employees) {
    const fixation = emp.fixations.length
      ? versionForMonthEnd(emp.fixations, monthEnd)
      : null;
    if (!fixation) {
      skipped.push({
        id: emp.id,
        name: emp.nameEn,
        reason: emp.fixations.length
          ? `no fixation in force at the end of ${month} ${year}`
          : "no salary fixation set",
      });
      continue;
    }

    const { arrearAmount } = await payMonth(emp.id, fixation, month, year, issueDate);
    arrearsPaid += arrearAmount;
    processed++;
  }

  return NextResponse.json({
    processed,
    skipped: skipped.length,
    arrearsPaid,
    // Named, so an operator can chase the gaps rather than guess at a count.
    skippedDetail: skipped.slice(0, 50),
    month,
    year,
  });
}

/**
 * Undo a processed month for an office.
 *
 * Needed because processing is strictly sequential: to go back and process a
 * month you missed, the later ones have to come off first. Refused once the
 * bank advice has been issued — that letter has gone to the bank.
 *
 * Any arrear settled by the deleted month is returned to pending, or the money
 * would simply vanish.
 */
export async function DELETE(req: Request) {
  const g = await gate();
  if (!g.ok) return g.response;

  const { month, year, officeId } = await req.json();
  if (!month || !year) {
    return NextResponse.json({ error: "month and year are required" }, { status: 400 });
  }

  const office = resolveOffice(g.scope, officeId);
  if (!office.ok) return NextResponse.json({ error: office.error }, { status: 400 });

  const advice = await prisma.bankAdvice.findFirst({
    where: { month, year, officeId: office.officeId },
    select: { id: true, memoNo: true },
  });
  if (advice) {
    return NextResponse.json(
      {
        error: `The bank advice for ${month} ${year} (${advice.memoNo}) has already been issued. Delete the advice first if this really needs to be undone.`,
      },
      { status: 409 },
    );
  }

  const rows = await prisma.salaryProcess.findMany({
    where: { month, year, employee: { officeId: office.officeId } },
    select: { id: true },
  });
  if (!rows.length) {
    return NextResponse.json(
      { error: `${month} ${year} has not been processed for this office.` },
      { status: 404 },
    );
  }
  const ids = rows.map((r) => r.id);

  const result = await prisma.$transaction(async (tx) => {
    // Return any arrears this month settled to pending, so they are paid again
    // by whichever month is processed next.
    const restored = await tx.salaryArrear.updateMany({
      where: { paidInProcessId: { in: ids } },
      data: { paidAt: null, paidInProcessId: null },
    });
    const deleted = await tx.salaryProcess.deleteMany({ where: { id: { in: ids } } });
    return { deleted: deleted.count, arrearsRestored: restored.count };
  });

  return NextResponse.json({ ...result, month, year });
}
