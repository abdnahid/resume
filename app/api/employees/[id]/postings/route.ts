import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "superadmin" && role !== "officeadmin") return null;
  return session;
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
    orderBy: { joinedAt: "asc" },
  });
  return NextResponse.json(postings);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: employeeId } = await params;
  const body = await req.json();
  const { orgPostId, officeId, grade, joinedAt, type, orderNo, orderDate, remarks } = body;

  if (!officeId || !grade || !joinedAt) {
    return NextResponse.json(
      { error: "officeId, grade, and joinedAt are required" },
      { status: 400 },
    );
  }

  // Close the current active posting
  await prisma.posting.updateMany({
    where: { employeeId, relievedAt: null },
    data: { relievedAt: joinedAt },
  });

  const posting = await prisma.posting.create({
    data: {
      employeeId,
      orgPostId: orgPostId ?? null,
      officeId: Number(officeId),
      grade,
      joinedAt,
      type: type ?? "transfer",
      orderNo: orderNo ?? null,
      orderDate: orderDate ?? null,
      remarks: remarks ?? null,
    },
    include: {
      orgPost: { include: { unit: { include: { parent: true } } } },
      office: true,
    },
  });

  return NextResponse.json(posting, { status: 201 });
}
