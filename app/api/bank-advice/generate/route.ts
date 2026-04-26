import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { numberToBengaliWords, generateMemoNo } from "@/lib/bengali";

const MONTH_IDX: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4,
  May: 5, June: 6, July: 7, August: 8,
  September: 9, October: 10, November: 11, December: 12,
};

function toOrder(month: string, year: string) {
  return Number(year) * 12 + (MONTH_IDX[month] ?? 0);
}

function todayDDMMYYYY(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

// <input type="date"> returns YYYY-MM-DD → convert to DD-MM-YYYY for storage
function isoToDisplay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}-${m}-${y}`;
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role ?? "employee";
  if (role !== "superadmin" && role !== "officeadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { month, year, chequeNo, depositDate } = await req.json();
  if (!month || !year || !chequeNo || !depositDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const existing = await prisma.bankAdvice.findUnique({
    where: { month_year: { month, year } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Bank advice already generated for this month" },
      { status: 409 }
    );
  }

  const processedCount = await prisma.salaryProcess.count({ where: { month, year } });
  if (processedCount === 0) {
    return NextResponse.json(
      { error: "No processed salary found for this month" },
      { status: 404 }
    );
  }

  // Linear fence: can't skip ahead past lastGenerated + 1
  const allAdvices = await prisma.bankAdvice.findMany({
    select: { month: true, year: true },
  });
  if (allAdvices.length > 0) {
    const lastOrder = Math.max(...allAdvices.map((a) => toOrder(a.month, a.year)));
    if (toOrder(month, year) > lastOrder + 1) {
      return NextResponse.json(
        { error: "Must generate in order. Complete the previous month first." },
        { status: 400 }
      );
    }
  }

  const processes = await prisma.salaryProcess.findMany({ where: { month, year } });
  const totalAmount = processes.reduce((s, p) => s + p.netSalary, 0);

  const advice = await prisma.bankAdvice.create({
    data: {
      memoNo:       generateMemoNo(month, year),
      month,
      year,
      chequeNo,
      chequeDate:   todayDDMMYYYY(),
      depositDate:  isoToDisplay(depositDate),
      totalAmount,
      totalInWords: numberToBengaliWords(totalAmount),
      employeeCount: processes.length,
    },
  });

  return NextResponse.json(advice);
}
