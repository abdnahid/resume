import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAttendanceSheet } from "@/lib/salary/attendance";
import { employeesOfOffice, resolvePayrollScope } from "@/lib/salary/payroll";
import { MAX_PAID_DAYS } from "@/lib/salary/daily";

/**
 * The attendance register for daily-basis staff.
 *
 * Scoped like payroll: an officeadmin is pinned to their own office, a
 * superadmin names one. Attendance decides what somebody is paid, so it is not
 * open to the roles that may only read records.
 */

type Gate =
  | { ok: false; response: NextResponse }
  | { ok: true; username: string; officeOf: (requested: unknown) => number | null };

async function gate(): Promise<Gate> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (
    !session ||
    (session.user as { accountType?: string }).accountType !== "INTERNAL"
  ) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const role = (session.user as { role?: string }).role ?? "employee";
  const username = session.user.username ?? "";
  const scope = await resolvePayrollScope(role, username);
  if (!scope) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Only an administrator can record attendance." },
        { status: 403 },
      ),
    };
  }
  return {
    ok: true,
    username,
    officeOf: (requested) => {
      if (scope.pinned) return scope.officeId;
      const n = Number(requested);
      return Number.isInteger(n) ? n : null;
    },
  };
}

export async function GET(req: Request) {
  const g = await gate();
  if (!g.ok) return g.response;

  const params = new URL(req.url).searchParams;
  const officeId = g.officeOf(params.get("officeId"));
  const month = params.get("month");
  const year = params.get("year");

  if (officeId === null) {
    return NextResponse.json({ error: "Choose an office." }, { status: 400 });
  }
  if (!month || !year) {
    return NextResponse.json({ error: "month and year are required" }, { status: 400 });
  }

  const sheet = await getAttendanceSheet(officeId, month, year);
  if (!sheet) return NextResponse.json({ error: "Office not found" }, { status: 404 });
  return NextResponse.json(sheet);
}

/**
 * Record days for a month. Accepts a partial set — the register saves what an
 * operator has filled in so far rather than demanding the whole office at once.
 */
export async function POST(req: Request) {
  const g = await gate();
  if (!g.ok) return g.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const officeId = g.officeOf(body.officeId);
  const month = typeof body.month === "string" ? body.month : "";
  const year = typeof body.year === "string" ? body.year : "";
  if (officeId === null) {
    return NextResponse.json({ error: "Choose an office." }, { status: 400 });
  }
  if (!month || !year) {
    return NextResponse.json({ error: "month and year are required" }, { status: 400 });
  }
  if (!Array.isArray(body.days)) {
    return NextResponse.json({ error: "days must be an array." }, { status: 400 });
  }

  // Only daily-basis staff of this office may be recorded — a stray id must not
  // be able to write attendance for somebody else's employee.
  const allowed = new Set(
    (
      await prisma.employee.findMany({
        where: { AND: [employeesOfOffice(officeId), { category: "daily_basis" }] },
        select: { id: true },
      })
    ).map((e) => e.id),
  );

  const clamped: string[] = [];
  const entries: { employeeId: string; daysWorked: number; note: string | null }[] = [];

  for (const raw of body.days as unknown[]) {
    const d = raw as { employeeId?: unknown; daysWorked?: unknown; note?: unknown };
    const employeeId = String(d.employeeId ?? "");
    if (!allowed.has(employeeId)) {
      return NextResponse.json(
        { error: `${employeeId} is not a daily-basis employee of this office.` },
        { status: 400 },
      );
    }
    // Blank means "not recorded yet" and is skipped, not stored as zero.
    if (d.daysWorked === null || d.daysWorked === undefined || d.daysWorked === "") continue;

    let days = Math.floor(Number(d.daysWorked));
    if (!Number.isFinite(days) || days < 0) {
      return NextResponse.json(
        { error: `Days for ${employeeId} must be a whole number of days.` },
        { status: 400 },
      );
    }
    if (days > MAX_PAID_DAYS) {
      clamped.push(employeeId);
      days = MAX_PAID_DAYS;
    }
    entries.push({
      employeeId,
      daysWorked: days,
      note: typeof d.note === "string" && d.note.trim() ? d.note.trim() : null,
    });
  }

  // A month already paid must not have its attendance quietly rewritten — the
  // payslip and the bank advice would then disagree with the register.
  const paid = await prisma.salaryProcess.findMany({
    where: { month, year, employeeId: { in: entries.map((e) => e.employeeId) } },
    select: { employeeId: true },
  });
  if (paid.length) {
    return NextResponse.json(
      {
        error: `${paid.length} of these have already been paid for ${month} ${year}. Undo that month before changing their attendance.`,
      },
      { status: 409 },
    );
  }

  await prisma.$transaction(
    entries.map((e) =>
      prisma.dailyAttendance.upsert({
        where: { employeeId_month_year: { employeeId: e.employeeId, month, year } },
        update: { daysWorked: e.daysWorked, note: e.note, recordedBy: g.username || null },
        create: {
          employeeId: e.employeeId,
          month,
          year,
          daysWorked: e.daysWorked,
          note: e.note,
          recordedBy: g.username || null,
        },
      }),
    ),
  );

  return NextResponse.json({
    saved: entries.length,
    clamped,
    maxDays: MAX_PAID_DAYS,
  });
}
