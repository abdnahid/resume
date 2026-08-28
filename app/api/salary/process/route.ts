import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { covers, dateKey, lastDayOfMonth, todayStored } from "@/lib/salary/dates";

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

export async function POST(req: Request) {
  // Internal-only mutation. `middleware.ts` already refuses clients and
  // anonymous callers on /api/*; this is the check that does not depend on a
  // cookie being readable.
  const session = await auth.api.getSession({ headers: await headers() });
  if (
    !session ||
    (session.user as { accountType?: string }).accountType !== "INTERNAL"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { month, year, employeeId } = await req.json();

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

  const issueDate = todayIssueDate();

  // ── Single-employee mode ───────────────────────────────────────────────────
  if (employeeId) {
    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { fixations: true },
    });

    if (!emp) {
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

  // ── Bulk mode ──────────────────────────────────────────────────────────────
  const employees = await prisma.employee.findMany({
    include: { fixations: true },
  });

  let processed = 0;
  let skipped = 0;
  let arrearsPaid = 0;
  const skippedIds: string[] = [];

  for (const emp of employees) {
    const fixation = emp.fixations.length
      ? versionForMonthEnd(emp.fixations, monthEnd)
      : null;
    if (!fixation) {
      skipped++;
      skippedIds.push(emp.id);
      continue;
    }

    const { arrearAmount } = await payMonth(emp.id, fixation, month, year, issueDate);
    arrearsPaid += arrearAmount;
    processed++;
  }

  return NextResponse.json({
    processed,
    skipped,
    arrearsPaid,
    // Capped: an unfixed roster of 400 would otherwise return a wall of ids.
    skippedIds: skippedIds.slice(0, 20),
    month,
    year,
  });
}
