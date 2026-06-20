import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — fetch employee's own postings
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = session.user.username ?? "";
  const postings = await prisma.posting.findMany({
    where: { employeeId },
    include: {
      orgPost: { include: { unit: { include: { parent: true } } } },
      office: true,
    },
    orderBy: { joinedAt: "asc" },
  });
  return NextResponse.json(postings);
}

// POST — employee self-reports a posting (selfReported=true, status=pending)
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = session.user.username ?? "";

  // Check serviceHistoryLocked
  const emp = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { serviceHistoryLocked: true },
  });
  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (emp.serviceHistoryLocked) {
    return NextResponse.json({ error: "Service history is locked. Contact admin." }, { status: 403 });
  }

  const { orgPostId, officeId, type, joinedAt, relievedAt, orderNo, orderDate, grade } = await req.json();
  if (!officeId) return NextResponse.json({ error: "officeId is required" }, { status: 400 });

  // Resolve grade from OrgPost if not provided
  let resolvedGrade = grade ?? "0";
  if (orgPostId && !grade) {
    const op = await prisma.orgPost.findUnique({ where: { id: Number(orgPostId) }, select: { grade: true } });
    if (op?.grade) resolvedGrade = op.grade;
  }

  const posting = await prisma.posting.create({
    data: {
      employeeId,
      officeId:    Number(officeId),
      orgPostId:   orgPostId ? Number(orgPostId) : null,
      grade:       resolvedGrade,
      type:        type ?? "initial",
      status:      "pending",
      selfReported: true,
      joinedAt:    joinedAt    || null,
      relievedAt:  relievedAt  || null,
      orderNo:     orderNo     || null,
      orderDate:   orderDate   || null,
    },
    include: {
      orgPost: { include: { unit: { include: { parent: true } } } },
      office: true,
    },
  });

  return NextResponse.json(posting, { status: 201 });
}
