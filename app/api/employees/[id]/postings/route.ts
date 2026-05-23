import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireSuperAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const role = (session.user as { role?: string }).role ?? "";
  return role === "superadmin" ? session : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const postings = await prisma.posting.findMany({
    where: { employeeId: id },
    include: {
      orgPost: { include: { unit: { include: { parent: true } } } },
      office: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(postings);
}

// POST /api/employees/[id]/postings
// Superadmin only. Creates a pending initial posting for a fresh employee.
// Body: { orgPostId?, officeId, orderNo?, orderDate? }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: employeeId } = await params;
  const body = await req.json();
  const { orgPostId, officeId, orderNo, orderDate } = body;

  if (!officeId) {
    return NextResponse.json({ error: "officeId is required" }, { status: 400 });
  }

  // Block if the employee already has an open posting
  const existing = await prisma.posting.findFirst({
    where: { employeeId, relievedAt: null },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Employee already has an active or pending posting. Release it first." },
      { status: 409 },
    );
  }

  // Resolve grade from OrgPost if available
  let grade = "0";
  if (orgPostId) {
    const orgPost = await prisma.orgPost.findUnique({
      where: { id: Number(orgPostId) },
      select: { grade: true },
    });
    if (orgPost?.grade) grade = orgPost.grade;
  }

  const posting = await prisma.posting.create({
    data: {
      employeeId,
      officeId: Number(officeId),
      orgPostId: orgPostId ? Number(orgPostId) : null,
      grade,
      type: "initial",
      status: "pending",
      joinedAt: null,
      orderNo: orderNo ?? null,
      orderDate: orderDate ?? null,
    },
    include: {
      orgPost: { include: { unit: { include: { parent: true } } } },
      office: true,
    },
  });

  return NextResponse.json(posting, { status: 201 });
}
