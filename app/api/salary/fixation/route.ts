import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Create or update an employee's salary fixation.
 *
 * Mirrors the gate on `/hr/listing/fixation` itself: superadmin sees every
 * office, officeadmin only their own. `middleware.ts` already refuses clients
 * and anonymous callers on `/api/*`; the session check here is the one that
 * does not depend on a cookie being readable (D12).
 */

/** NPS-2015 runs grade 1 (highest) to grade 20. */
const MIN_GRADE = 1;
const MAX_GRADE = 20;

/** Only these two are stored. `expired` is computed from `validThru` at read
 *  time, and `not_found` simply means no row exists — see `lib/db.ts`. */
const STORED_STATUSES = ["active", "inactive"] as const;
type StoredStatus = (typeof STORED_STATUSES)[number];

/**
 * Every other fixation date in this database is `MM-DD-YYYY`, so that is what
 * we store. `<input type="date">` hands us `YYYY-MM-DD`, so accept both.
 * Returns null when the string is not a real calendar date.
 */
function toStoredDate(input: unknown): string | null {
  if (typeof input !== "string") return null;

  let y: number, m: number, d: number;
  const ymd = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const mdy = input.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (ymd) [y, m, d] = [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])];
  else if (mdy) [m, d, y] = [Number(mdy[1]), Number(mdy[2]), Number(mdy[3])];
  else return null;

  // Reject 02-31 and friends — Date rolls them over silently.
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }

  return `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}-${y}`;
}

/** `MM-DD-YYYY` → comparable number. Assumes an already-validated string. */
function dateKey(stored: string): number {
  const [m, d, y] = stored.split("-").map(Number);
  return y * 10000 + m * 100 + d;
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
  if (role !== "superadmin" && role !== "officeadmin") {
    return NextResponse.json(
      { error: "Only an administrator can set salary fixation." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { employeeId, grade, basicSalary, validFrom, validThru, salaryStatus } =
    body;

  if (typeof employeeId !== "string" || !employeeId) {
    return NextResponse.json(
      { error: "employeeId is required" },
      { status: 400 },
    );
  }

  const gradeNum = Number(grade);
  if (!Number.isInteger(gradeNum) || gradeNum < MIN_GRADE || gradeNum > MAX_GRADE) {
    return NextResponse.json(
      { error: `Grade must be a whole number between ${MIN_GRADE} and ${MAX_GRADE}.` },
      { status: 400 },
    );
  }

  const salaryNum = Number(basicSalary);
  if (!Number.isInteger(salaryNum) || salaryNum <= 0) {
    return NextResponse.json(
      { error: "Basic salary must be a whole number greater than zero." },
      { status: 400 },
    );
  }

  const from = toStoredDate(validFrom);
  const thru = toStoredDate(validThru);
  if (!from) {
    return NextResponse.json({ error: "Valid from is not a real date." }, { status: 400 });
  }
  if (!thru) {
    return NextResponse.json({ error: "Valid through is not a real date." }, { status: 400 });
  }
  if (dateKey(thru) < dateKey(from)) {
    return NextResponse.json(
      { error: "Valid through cannot be earlier than valid from." },
      { status: 400 },
    );
  }

  const status: StoredStatus = STORED_STATUSES.includes(
    salaryStatus as StoredStatus,
  )
    ? (salaryStatus as StoredStatus)
    : "active";

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, officeId: true },
  });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // An officeadmin may only fix salaries inside their own office. Refusing with
  // 404 rather than 403 keeps other offices' rosters unconfirmable.
  if (role === "officeadmin") {
    const admin = await prisma.employee.findUnique({
      where: { id: session.user.username ?? "" },
      select: { officeId: true },
    });
    if (!admin || admin.officeId !== employee.officeId) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
  }

  const data = {
    grade: gradeNum,
    basicSalary: salaryNum,
    validFrom: from,
    validThru: thru,
    salaryStatus: status,
  };

  const saved = await prisma.salaryFixation.upsert({
    where: { employeeId },
    update: data,
    create: { employeeId, ...data },
  });

  return NextResponse.json({ fixation: saved });
}
