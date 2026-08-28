import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { numberToBengaliWords, generateMemoNo } from "@/lib/bengali";
import {
  monthOrder,
  resolvePayrollScope,
  type PayrollScope,
} from "@/lib/salary/payroll";

/**
 * Generate one office's bank advice for one month.
 *
 * Per office: each office pays its own staff on its own cheque, and the letter
 * names that office. Previously this summed every processed employee in the
 * institute into a single letter addressed from Head Office.
 *
 * The month must already be processed, and advices are issued in order for an
 * office, so the bank never receives a later month before an earlier one.
 */

// `<input type="date">` gives YYYY-MM-DD; the documents are all DD-MM-YYYY.
function isoToDisplay(isoDate: string): string | null {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const probe = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (
    probe.getUTCFullYear() !== Number(m[1]) ||
    probe.getUTCMonth() !== Number(m[2]) - 1 ||
    probe.getUTCDate() !== Number(m[3])
  ) {
    return null;
  }
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (
    !session ||
    (session.user as { accountType?: string }).accountType !== "INTERNAL"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const role = (session.user as { role?: string }).role ?? "employee";
  const scope: PayrollScope | null = await resolvePayrollScope(
    role,
    session.user.username ?? "",
  );
  if (!scope) {
    return NextResponse.json(
      { error: "Only an administrator can generate a bank advice." },
      { status: 403 },
    );
  }

  const { month, year, chequeNo, chequeDate, depositDate, officeId } =
    await req.json();

  if (!month || !year || !chequeNo || !depositDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // An officeadmin is pinned to their own office whatever they send.
  const targetOffice = scope.pinned ? scope.officeId! : Number(officeId);
  if (!Number.isInteger(targetOffice)) {
    return NextResponse.json(
      { error: "Choose which office this advice is for." },
      { status: 400 },
    );
  }

  const office = await prisma.office.findUnique({
    where: { id: targetOffice },
    select: { id: true, nameEn: true, nameBn: true },
  });
  if (!office) {
    return NextResponse.json({ error: "Office not found" }, { status: 404 });
  }

  const deposit = isoToDisplay(String(depositDate));
  if (!deposit) {
    return NextResponse.json({ error: "Deposit date is not a real date." }, { status: 400 });
  }
  // The cheque date used to be silently "today"; it is now entered, and falls
  // back to today only when omitted.
  const cheque = chequeDate ? isoToDisplay(String(chequeDate)) : null;
  if (chequeDate && !cheque) {
    return NextResponse.json({ error: "Cheque date is not a real date." }, { status: 400 });
  }
  const chequeDisplay =
    cheque ??
    (() => {
      const d = new Date();
      return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
    })();

  const existing = await prisma.bankAdvice.findFirst({
    where: { month, year, officeId: office.id },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: `A bank advice for ${month} ${year} already exists for ${office.nameEn}.` },
      { status: 409 },
    );
  }

  const processes = await prisma.salaryProcess.findMany({
    where: { month, year, employee: { officeId: office.id } },
    select: { netSalary: true },
  });
  if (processes.length === 0) {
    return NextResponse.json(
      { error: `No salary has been processed for ${office.nameEn} in ${month} ${year}.` },
      { status: 404 },
    );
  }

  // Advices go to the bank in order, per office.
  const previous = await prisma.bankAdvice.findMany({
    where: { officeId: office.id },
    select: { month: true, year: true },
  });
  if (previous.length > 0) {
    const lastOrder = Math.max(...previous.map((a) => monthOrder(a.month, a.year)));
    if (monthOrder(month, year) > lastOrder + 1) {
      return NextResponse.json(
        { error: "Advices must be issued in order. Complete the previous month first." },
        { status: 400 },
      );
    }
  }

  const totalAmount = processes.reduce((s, p) => s + p.netSalary, 0);

  const advice = await prisma.bankAdvice.create({
    data: {
      memoNo: generateMemoNo(month, year),
      month,
      year,
      officeId: office.id,
      chequeNo,
      chequeDate: chequeDisplay,
      depositDate: deposit,
      totalAmount,
      totalInWords: numberToBengaliWords(totalAmount),
      employeeCount: processes.length,
    },
  });

  return NextResponse.json(advice);
}
