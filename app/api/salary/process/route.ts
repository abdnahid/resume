import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function effectiveStatus(validThru: string, stored: string): string {
  if (stored === "inactive") return "inactive";
  let expiry: Date | null = null;
  const mdy = validThru.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  const ymd = validThru.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (mdy) expiry = new Date(`${mdy[3]}-${mdy[1]}-${mdy[2]}`);
  else if (ymd) expiry = new Date(validThru);
  if (expiry) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (expiry < today) return "expired";
  }
  return "active";
}

function todayIssueDate() {
  const today = new Date();
  return [
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
    today.getFullYear(),
  ].join("-");
}

export async function POST(req: Request) {
  // Internal-only mutation. `middleware.ts` already refuses clients and
  // anonymous callers on /api/*; this is the check that does not depend on a
  // cookie being readable.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as { accountType?: string }).accountType !== "INTERNAL") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { month, year, employeeId } = await req.json();

  if (!month || !year) {
    return NextResponse.json({ error: "month and year are required" }, { status: 400 });
  }

  const issueDate = todayIssueDate();

  // ── Single-employee mode ───────────────────────────────────────────────────
  if (employeeId) {
    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { fixation: true },
    });

    if (!emp) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    if (!emp.fixation) {
      return NextResponse.json(
        { error: "No fixation record found. Set up salary fixation first." },
        { status: 400 },
      );
    }

    const status = effectiveStatus(emp.fixation.validThru, emp.fixation.salaryStatus);
    if (status !== "active") {
      const label = status === "inactive" ? "inactive" : "expired";
      return NextResponse.json(
        { error: `Employee fixation is ${label}. Edit fixation to process salary.` },
        { status: 400 },
      );
    }

    await prisma.salaryProcess.upsert({
      where: { employeeId_month_year: { employeeId: emp.id, month, year } },
      update: {},
      create: { employeeId: emp.id, netSalary: emp.fixation.basicSalary, issueDate, month, year },
    });

    return NextResponse.json({ processed: 1, skipped: 0, month, year });
  }

  // ── Bulk mode ──────────────────────────────────────────────────────────────
  const employees = await prisma.employee.findMany({ include: { fixation: true } });

  let processed = 0;
  let skipped = 0;

  for (const emp of employees) {
    if (!emp.fixation) { skipped++; continue; }
    if (effectiveStatus(emp.fixation.validThru, emp.fixation.salaryStatus) !== "active") {
      skipped++;
      continue;
    }

    await prisma.salaryProcess.upsert({
      where: { employeeId_month_year: { employeeId: emp.id, month, year } },
      update: {},
      create: { employeeId: emp.id, netSalary: emp.fixation.basicSalary, issueDate, month, year },
    });
    processed++;
  }

  return NextResponse.json({ processed, skipped, month, year });
}
