import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CASE_STATUSES,
  getArrears,
  getCase,
  requireCaseHandler,
} from "@/lib/salary/cases";
import { toStoredDate } from "@/lib/salary/dates";

async function caseId(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const g = await requireCaseHandler();
  if (!g.ok) return g.response;

  const id = await caseId(context);
  if (id === null) return NextResponse.json({ error: "Invalid case id" }, { status: 400 });

  const record = await getCase(id);
  if (!record) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  return NextResponse.json({ case: record, arrears: await getArrears(record.employee.id) });
}

/** Status, title and summary are editable; the case number and employee are not. */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const g = await requireCaseHandler();
  if (!g.ok) return g.response;

  const id = await caseId(context);
  if (id === null) return NextResponse.json({ error: "Invalid case id" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const existing = await prisma.employeeCase.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const status = body.status === undefined ? existing.status : String(body.status);
  if (!CASE_STATUSES.includes(status as never)) {
    return NextResponse.json({ error: "Unknown case status." }, { status: 400 });
  }

  const closedOn =
    body.closedOn === undefined || body.closedOn === null || body.closedOn === ""
      ? null
      : toStoredDate(body.closedOn);
  if (body.closedOn && !closedOn) {
    return NextResponse.json({ error: "Closed-on is not a real date." }, { status: 400 });
  }

  const updated = await prisma.employeeCase.update({
    where: { id },
    data: {
      status: status as never,
      closedOn,
      title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : existing.title,
      summary:
        typeof body.summary === "string"
          ? body.summary.trim() || null
          : existing.summary,
    },
  });
  return NextResponse.json({ case: updated });
}
