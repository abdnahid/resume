import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CLAUSE_TYPES, requireCaseHandler } from "@/lib/salary/cases";
import { dateKey, toStoredDate } from "@/lib/salary/dates";
import { imposeVerdict } from "@/lib/salary/verdicts";
import type { VerdictClauseType } from "@/lib/salary/compute";
import { MAX_GRADE, MIN_GRADE } from "@/lib/salary/compute";

/**
 * Record a verdict and apply it to the employee's pay in one step.
 *
 * Recording and imposing are deliberately not separable: a verdict that sits on
 * the register without touching pay is the failure mode this whole feature
 * exists to remove. If the pay side fails — no fixation to modify, a month
 * already disbursed — the verdict is not written either, so the register never
 * disagrees with the salary.
 */

/** Which clauses need a `value`, and what range it may take. */
const VALUE_RULES: Record<
  VerdictClauseType,
  { required: boolean; min?: number; max?: number; label: string }
> = {
  reduce_increments: { required: true, min: 1, max: 20, label: "increments to reduce" },
  withhold_increment: { required: true, min: 1, max: 10, label: "years to withhold" },
  demote_grade: { required: true, min: MIN_GRADE, max: MAX_GRADE, label: "the grade to demote to" },
  basic_percent: { required: true, min: 1, max: 100, label: "the percentage of basic" },
  suppress_allowances: { required: false, label: "" },
  suppress_head: { required: false, label: "" },
};

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const g = await requireCaseHandler();
  if (!g.ok) return g.response;

  const { id } = await context.params;
  const caseId = Number(id);
  if (!Number.isInteger(caseId)) {
    return NextResponse.json({ error: "Invalid case id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const kase = await prisma.employeeCase.findUnique({ where: { id: caseId } });
  if (!kase) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const orderNo = typeof body.orderNo === "string" ? body.orderNo.trim() : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  const verdictDate = toStoredDate(body.verdictDate);
  const effectiveFrom = toStoredDate(body.effectiveFrom);
  const effectiveTo =
    body.effectiveTo === undefined || body.effectiveTo === null || body.effectiveTo === ""
      ? null
      : toStoredDate(body.effectiveTo);

  if (!orderNo) return NextResponse.json({ error: "An order number is required." }, { status: 400 });
  if (!summary) return NextResponse.json({ error: "A summary of the verdict is required." }, { status: 400 });
  if (!verdictDate) return NextResponse.json({ error: "Verdict date is not a real date." }, { status: 400 });
  if (!effectiveFrom) return NextResponse.json({ error: "Effective-from is not a real date." }, { status: 400 });
  if (body.effectiveTo && !effectiveTo) {
    return NextResponse.json({ error: "Effective-to is not a real date." }, { status: 400 });
  }
  if (effectiveTo && dateKey(effectiveTo) < dateKey(effectiveFrom)) {
    return NextResponse.json(
      { error: "The verdict cannot end before it begins." },
      { status: 400 },
    );
  }

  // ── Clauses ──
  if (!Array.isArray(body.clauses) || body.clauses.length === 0) {
    return NextResponse.json(
      { error: "A verdict needs at least one clause — otherwise it changes nothing." },
      { status: 400 },
    );
  }

  const clauses: { type: VerdictClauseType; value: number | null; headId: number | null }[] = [];
  for (const raw of body.clauses as unknown[]) {
    const c = raw as { type?: unknown; value?: unknown; headId?: unknown };
    const type = c.type as VerdictClauseType;
    if (!CLAUSE_TYPES.includes(type)) {
      return NextResponse.json({ error: `Unknown clause "${String(c.type)}".` }, { status: 400 });
    }
    if (clauses.some((x) => x.type === type && type !== "suppress_head")) {
      return NextResponse.json(
        { error: `The verdict lists "${type}" twice.` },
        { status: 400 },
      );
    }

    const rule = VALUE_RULES[type];
    let value: number | null = null;
    if (rule.required) {
      const n = Number(c.value);
      if (!Number.isInteger(n) || n < (rule.min ?? 0) || n > (rule.max ?? Number.MAX_SAFE_INTEGER)) {
        return NextResponse.json(
          { error: `Give ${rule.label} as a whole number between ${rule.min} and ${rule.max}.` },
          { status: 400 },
        );
      }
      value = n;
    }

    let headId: number | null = null;
    if (type === "suppress_head") {
      const n = Number(c.headId);
      if (!Number.isInteger(n)) {
        return NextResponse.json(
          { error: "Choose which allowance or deduction the verdict cancels." },
          { status: 400 },
        );
      }
      const head = await prisma.salaryHead.findUnique({ where: { id: n }, select: { id: true } });
      if (!head) return NextResponse.json({ error: "That salary head does not exist." }, { status: 400 });
      headId = n;
    }

    clauses.push({ type, value, headId });
  }

  // ── Write, then apply. If applying throws, the verdict is rolled back. ──
  const verdict = await prisma.caseVerdict.create({
    data: {
      caseId,
      orderNo,
      verdictDate,
      effectiveFrom,
      effectiveTo,
      summary,
      reduceDerivedAllowances: body.reduceDerivedAllowances === true,
      createdBy: g.username || null,
      clauses: { create: clauses },
    },
  });

  try {
    const result = await imposeVerdict(verdict.id, g.username || null);
    await prisma.employeeCase.update({
      where: { id: caseId },
      data: { status: "verdict_given" },
    });
    return NextResponse.json({ verdict, applied: result });
  } catch (err) {
    await prisma.caseVerdict.delete({ where: { id: verdict.id } });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not apply the verdict." },
      { status: 409 },
    );
  }
}
