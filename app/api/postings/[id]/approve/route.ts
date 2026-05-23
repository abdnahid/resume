import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserOfficeId } from "@/lib/db";

// POST /api/postings/[id]/approve
// Body: { joinedAt }
// Sets status=active, joinedAt, and syncs Employee.officeId.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "superadmin" && role !== "officeadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = parseInt((await params).id);
  const body = await req.json();
  const { joinedAt } = body;

  if (!joinedAt) {
    return NextResponse.json({ error: "joinedAt is required" }, { status: 400 });
  }

  const posting = await prisma.posting.findUnique({
    where: { id },
    select: { id: true, status: true, officeId: true, employeeId: true },
  });
  if (!posting || posting.status !== "pending") {
    return NextResponse.json({ error: "Posting not found or not pending" }, { status: 404 });
  }

  // Office admin can only approve postings at their office
  if (role === "officeadmin") {
    const myOfficeId = await getUserOfficeId(session.user.id);
    if (posting.officeId !== myOfficeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Approve: activate posting + sync employee's office
  const [updated] = await prisma.$transaction([
    prisma.posting.update({
      where: { id },
      data: { status: "active", joinedAt },
      include: {
        orgPost: { include: { unit: { include: { parent: true } } } },
        office: true,
      },
    }),
    prisma.employee.update({
      where: { id: posting.employeeId },
      data: { officeId: posting.officeId },
    }),
  ]);

  return NextResponse.json(updated);
}
