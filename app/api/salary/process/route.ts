import { NextResponse } from "next/server";
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

export async function POST(req: Request) {
  const { month, year } = await req.json();
  if (!month || !year) {
    return NextResponse.json({ error: "month and year are required" }, { status: 400 });
  }

  const employees = await prisma.employee.findMany({
    include: { fixation: true },
  });

  const today = new Date();
  const issueDate = [
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
    today.getFullYear(),
  ].join("-");

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
      create: {
        employeeId: emp.id,
        netSalary: emp.fixation.basicSalary,
        issueDate,
        month,
        year,
      },
    });
    processed++;
  }

  return NextResponse.json({ processed, skipped, month, year });
}
