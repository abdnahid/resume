import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CASE_FORUMS,
  CASE_STATUSES,
  getCases,
  requireCaseHandler,
} from "@/lib/salary/cases";
import { toStoredDate } from "@/lib/salary/dates";

/** The case register. Case officers and superadmins only. */

export async function GET(req: Request) {
  const g = await requireCaseHandler();
  if (!g.ok) return g.response;

  const params = new URL(req.url).searchParams;
  const cases = await getCases({
    employeeId: params.get("employeeId") ?? undefined,
    status: params.get("status") ?? undefined,
  });
  return NextResponse.json({ cases });
}

export async function POST(req: Request) {
  const g = await requireCaseHandler();
  if (!g.ok) return g.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
  const caseNo = typeof body.caseNo === "string" ? body.caseNo.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const forum = String(body.forum ?? "");
  const status = String(body.status ?? "open");
  const filedOn = toStoredDate(body.filedOn);

  if (!employeeId) return NextResponse.json({ error: "Choose an employee." }, { status: 400 });
  if (!caseNo) return NextResponse.json({ error: "A case number is required." }, { status: 400 });
  if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });
  if (!CASE_FORUMS.includes(forum as never)) {
    return NextResponse.json({ error: "Choose a forum." }, { status: 400 });
  }
  if (!CASE_STATUSES.includes(status as never)) {
    return NextResponse.json({ error: "Unknown case status." }, { status: 400 });
  }
  if (!filedOn) return NextResponse.json({ error: "Filed-on is not a real date." }, { status: 400 });

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true },
  });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const clash = await prisma.employeeCase.findUnique({ where: { caseNo }, select: { id: true } });
  if (clash) {
    return NextResponse.json(
      { error: `Case ${caseNo} is already on the register.` },
      { status: 409 },
    );
  }

  const created = await prisma.employeeCase.create({
    data: {
      employeeId,
      caseNo,
      title,
      forum: forum as never,
      status: status as never,
      filedOn,
      summary: typeof body.summary === "string" && body.summary.trim() ? body.summary.trim() : null,
      createdBy: g.username || null,
    },
  });
  return NextResponse.json({ case: created });
}
