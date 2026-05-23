import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserOfficeId } from "@/lib/db";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

async function requireAdminWithOffice() {
  const session = await getSession();
  if (!session) return null;
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "superadmin" && role !== "officeadmin") return null;
  const officeId = role === "officeadmin"
    ? await getUserOfficeId(session.user.id)
    : null;
  return { role, officeId };
}

// PATCH /api/postings/[id]
// Body: { releasedAt, orderNo, orderDate, newOfficeId, newOrgPostId? }
// Closes the current posting and creates a new pending posting at the new office.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminWithOffice();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = parseInt((await params).id);
  const body = await req.json();
  const { releasedAt, orderNo, orderDate, newOfficeId, newOrgPostId } = body;

  if (!releasedAt || !newOfficeId) {
    return NextResponse.json(
      { error: "releasedAt and newOfficeId are required" },
      { status: 400 },
    );
  }

  // Fetch the posting being released
  const posting = await prisma.posting.findUnique({
    where: { id },
    include: { employee: true },
  });
  if (!posting || posting.relievedAt !== null) {
    return NextResponse.json({ error: "Posting not found or already closed" }, { status: 404 });
  }

  // Office admin can only release from their own office
  if (admin.role === "officeadmin" && posting.officeId !== admin.officeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Resolve grade for the new posting: prefer OrgPost grade, fall back to current grade
  let newGrade = posting.grade;
  if (newOrgPostId) {
    const orgPost = await prisma.orgPost.findUnique({
      where: { id: Number(newOrgPostId) },
      select: { grade: true },
    });
    if (orgPost?.grade) newGrade = orgPost.grade;
  }

  // Transaction: close current posting + create new pending posting
  const [, newPosting] = await prisma.$transaction([
    prisma.posting.update({
      where: { id },
      data: {
        relievedAt: releasedAt,
        orderNo: orderNo ?? null,
        orderDate: orderDate ?? null,
      },
    }),
    prisma.posting.create({
      data: {
        employeeId: posting.employeeId,
        officeId: Number(newOfficeId),
        orgPostId: newOrgPostId ? Number(newOrgPostId) : null,
        grade: newGrade,
        type: "transfer",
        status: "pending",
        orderNo: orderNo ?? null,
        orderDate: orderDate ?? null,
      },
      include: {
        orgPost: { include: { unit: { include: { parent: true } } } },
        office: true,
      },
    }),
  ]);

  return NextResponse.json(newPosting);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "superadmin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = parseInt((await params).id);
  await prisma.posting.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
