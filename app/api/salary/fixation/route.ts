import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computeSheet,
  headsToSheetInputs,
  MAX_GRADE,
  MIN_GRADE,
  type FixationReason,
} from "@/lib/salary/compute";
import {
  dateKey,
  dayBefore,
  lastDayOfMonth,
  toStoredDate,
} from "@/lib/salary/dates";
import {
  getActiveScale,
  getEmployeeFixations,
  getFixationContext,
} from "@/lib/salary/queries";

/**
 * Create, or edit, one version of an employee's salary fixation.
 *
 * Fixation is versioned. The ordinary case is one version per fiscal year from
 * 1 July, but a special increment, a promotion or a punishment mid-year raises
 * a new version from its own effective date, and the version it displaces is
 * truncated to the day before and marked superseded. Nothing is overwritten,
 * because `SalaryProcess` rows point at the version they were paid from.
 *
 * The sheet is computed here with the same `computeSheet()` the preview in
 * `FixationModal` calls, so what an operator checks is by construction what
 * gets stored.
 *
 * Mirrors the gate on `/hr/listing/fixation` itself: superadmin sees every
 * office, officeadmin only their own. `middleware.ts` already refuses clients
 * and anonymous callers on `/api/*`; the session check here is the one that
 * does not depend on a cookie being readable (D12).
 */

/** Only these two are stored. `expired` is computed at read time — see
 *  `effectiveStatus()` in `lib/salary/queries.ts`. */
const STORED_STATUSES = ["active", "inactive"] as const;
type StoredStatus = (typeof STORED_STATUSES)[number];

const REASONS: FixationReason[] = [
  "annual",
  "initial",
  "increment",
  "promotion",
  "punishment",
  "correction",
];

type Gate =
  | { ok: false; response: NextResponse }
  | { ok: true; role: string; username: string };

/** Session + role + INTERNAL. Shared by both handlers. */
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
  if (role !== "superadmin" && role !== "officeadmin") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Only an administrator can set salary fixation." },
        { status: 403 },
      ),
    };
  }
  return { ok: true, role, username: session.user.username ?? "" };
}

/**
 * An officeadmin may only touch salaries inside their own office. Refusing
 * with 404 rather than 403 keeps other offices' rosters unconfirmable.
 */
async function findEmployeeInScope(
  employeeId: string,
  role: string,
  username: string,
) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, officeId: true },
  });
  if (!employee) return null;

  if (role === "officeadmin") {
    const admin = await prisma.employee.findUnique({
      where: { id: username },
      select: { officeId: true },
    });
    if (!admin || admin.officeId !== employee.officeId) return null;
  }
  return employee;
}

// ─── GET: the form's context and the employee's version history ─────────────

export async function GET(req: Request) {
  const g = await gate();
  if (!g.ok) return g.response;

  const employeeId = new URL(req.url).searchParams.get("employeeId");
  if (!employeeId) {
    return NextResponse.json(
      { error: "employeeId is required" },
      { status: 400 },
    );
  }

  const employee = await findEmployeeInScope(employeeId, g.role, g.username);
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const [context, versions] = await Promise.all([
    getFixationContext(employeeId),
    getEmployeeFixations(employeeId),
  ]);

  return NextResponse.json({ context, versions });
}

// ─── POST: save a version ──────────────────────────────────────────────────

export async function POST(req: Request) {
  const g = await gate();
  if (!g.ok) return g.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    employeeId,
    fixationId,
    grade,
    step,
    validFrom,
    validThru,
    salaryStatus,
    reason,
    note,
    items,
  } = body;

  if (typeof employeeId !== "string" || !employeeId) {
    return NextResponse.json(
      { error: "employeeId is required" },
      { status: 400 },
    );
  }

  const employee = await findEmployeeInScope(employeeId, g.role, g.username);
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // ── Grade and step ───────────────────────────────────────────────────────
  const gradeNum = Number(grade);
  if (!Number.isInteger(gradeNum) || gradeNum < MIN_GRADE || gradeNum > MAX_GRADE) {
    return NextResponse.json(
      {
        error: `Grade must be a whole number between ${MIN_GRADE} and ${MAX_GRADE}.`,
      },
      { status: 400 },
    );
  }

  const scale = await getActiveScale();

  // Basic salary is never typed. It is the government scale's figure for the
  // grade and step, full stop — a half salary or a lost increment is a verdict
  // applied on top, not a number an operator invents. `basicSalary` in the
  // request body is ignored; only `step` decides.
  if (!scale || !scale.verified) {
    return NextResponse.json(
      {
        error:
          "No verified pay scale is loaded, so basic salary cannot be resolved. Run `npm run seed:salary` first.",
      },
      { status: 400 },
    );
  }

  if (step === undefined || step === null || step === "") {
    return NextResponse.json(
      { error: "Choose a step — basic salary comes from the pay scale, not by hand." },
      { status: 400 },
    );
  }

  const stepNum = Number(step);
  if (!Number.isInteger(stepNum) || stepNum < 0) {
    return NextResponse.json({ error: "Step must be a whole number." }, { status: 400 });
  }

  const cell = scale.steps.find(
    (s) => s.grade === gradeNum && s.step === stepNum,
  );
  if (!cell) {
    return NextResponse.json(
      { error: `The ${scale.code} grid has no step ${stepNum} for grade ${gradeNum}.` },
      { status: 400 },
    );
  }
  const scaleBasic = cell.amount;
  const resolvedBasic = scaleBasic;

  // ── Dates ────────────────────────────────────────────────────────────────
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

  const status: StoredStatus = STORED_STATUSES.includes(salaryStatus as StoredStatus)
    ? (salaryStatus as StoredStatus)
    : "active";

  const reasonValue: FixationReason = REASONS.includes(reason as FixationReason)
    ? (reason as FixationReason)
    : "annual";

  // ── Heads ────────────────────────────────────────────────────────────────
  if (items !== undefined && !Array.isArray(items)) {
    return NextResponse.json({ error: "items must be an array." }, { status: 400 });
  }

  const selected: { headId: number; value: number | null }[] = [];
  for (const raw of (items ?? []) as unknown[]) {
    const it = raw as { headId?: unknown; value?: unknown };
    const headId = Number(it.headId);
    if (!Number.isInteger(headId)) {
      return NextResponse.json({ error: "Each item needs a headId." }, { status: 400 });
    }
    const value =
      it.value === null || it.value === undefined || it.value === ""
        ? null
        : Number(it.value);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      return NextResponse.json(
        { error: "A head's amount or percentage cannot be negative." },
        { status: 400 },
      );
    }
    if (selected.some((s) => s.headId === headId)) {
      return NextResponse.json(
        { error: "The same head is listed twice." },
        { status: 400 },
      );
    }
    selected.push({ headId, value: value === null ? null : Math.round(value) });
  }

  const context = await getFixationContext(employeeId);
  if (!context) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const unknownHead = selected.find(
    (s) => !context.heads.some((h) => h.id === s.headId),
  );
  if (unknownHead) {
    return NextResponse.json(
      { error: `Head ${unknownHead.headId} does not exist or is retired.` },
      { status: 400 },
    );
  }

  // ── The sheet — the same call the preview makes ─────────────────────────
  const sheet = computeSheet({
    basicSalary: resolvedBasic,
    zone: context.zone,
    heads: headsToSheetInputs(context.heads, selected),
    slabs: context.slabs,
  });

  if (sheet.netSalary < 0) {
    return NextResponse.json(
      { error: "Deductions exceed gross pay — this fixation would pay a negative salary." },
      { status: 400 },
    );
  }

  // ── Versioning ───────────────────────────────────────────────────────────
  const existing = await getEmployeeFixations(employeeId);

  // Editing an existing version in place.
  if (fixationId !== undefined && fixationId !== null) {
    const target = existing.find((v) => v.id === Number(fixationId));
    if (!target) {
      return NextResponse.json({ error: "Fixation not found" }, { status: 404 });
    }
    if (target.isLocked) {
      return NextResponse.json(
        {
          error:
            "A salary month has already been processed against this fixation, so it can no longer be edited. Raise a new version instead — it will supersede this one from its own effective date.",
        },
        { status: 409 },
      );
    }
  }

  const targetId = fixationId === undefined || fixationId === null ? null : Number(fixationId);

  // Versions this one displaces: still in force, and overlapping the new range.
  const overlapping = existing.filter(
    (v) =>
      v.id !== targetId &&
      !v.supersededAt &&
      dateKey(v.validFrom) <= dateKey(thru) &&
      dateKey(from) <= dateKey(v.validThru),
  );

  // A month already paid against a version cannot fall inside the new range —
  // that would silently restate a salary that has been disbursed.
  for (const v of overlapping.filter((v) => v.isLocked)) {
    const processed = await prisma.salaryProcess.findMany({
      where: { fixationId: v.id },
      select: { month: true, year: true },
    });
    const clash = processed.find((pr) => {
      const end = lastDayOfMonth(pr.month, pr.year);
      return end !== null && dateKey(end) >= dateKey(from);
    });
    if (clash) {
      return NextResponse.json(
        {
          error: `${clash.month} ${clash.year} has already been processed against the current fixation. A new version must start after the last processed month.`,
        },
        { status: 409 },
      );
    }
  }

  const data = {
    grade: gradeNum,
    step: stepNum,
    basicSalary: resolvedBasic,
    validFrom: from,
    validThru: thru,
    salaryStatus: status,
    reason: reasonValue,
    note: typeof note === "string" && note.trim() ? note.trim() : null,
    grossEarning: sheet.grossEarning,
    totalDeduction: sheet.totalDeduction,
    netSalary: sheet.netSalary,
    scaleId: scale.id,
  };

  const lines = [...sheet.earnings, ...sheet.deductions].map((l) => ({
    headId: l.headId,
    kind: l.kind,
    basis: l.basis,
    value: l.basis === "house_rent_rule" ? null : (l.value ?? 0),
    amount: l.amount,
    sortOrder: l.sortOrder,
  }));

  const saved = await prisma.$transaction(async (tx) => {
    // Truncate the versions this one displaces to the day before it starts.
    // A version that started on or after the new one is fully replaced.
    for (const v of overlapping) {
      const startsBefore = dateKey(v.validFrom) < dateKey(from);
      await tx.salaryFixation.update({
        where: { id: v.id },
        data: {
          validThru: startsBefore ? dayBefore(from) : v.validThru,
          supersededAt: new Date(),
        },
      });
    }

    if (targetId !== null) {
      await tx.salaryFixationItem.deleteMany({ where: { fixationId: targetId } });
      return tx.salaryFixation.update({
        where: { id: targetId },
        data: { ...data, items: { create: lines } },
        include: { items: true },
      });
    }

    return tx.salaryFixation.create({
      data: {
        employeeId,
        ...data,
        createdBy: g.username || null,
        items: { create: lines },
      },
      include: { items: true },
    });
  });

  return NextResponse.json({
    fixation: saved,
    sheet,
    superseded: overlapping.map((v) => v.id),
  });
}
