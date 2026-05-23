import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserOfficeId } from "@/lib/db";

// POST /api/employees/[id]/release
// Body: { releasedAt, orderNo?, orderDate?, newOfficeId, newOrgPostId? }
//
// Closes the employee's current active/pending posting (if any) and creates a
// new pending posting at the destination office. Works for legacy employees
// that have no Posting record yet.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const role = (session.user as { role?: string }).role ?? "";
    if (role !== "superadmin" && role !== "officeadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: employeeId } = await params;
    const body = await req.json();
    const { releasedAt, orderNo, orderDate, newOfficeId, newOrgPostId } = body;

    if (!releasedAt || !newOfficeId) {
      return NextResponse.json(
        { error: "releasedAt and newOfficeId are required" },
        { status: 400 },
      );
    }

    // Find current open posting (active or pending)
    const currentPosting = await prisma.posting.findFirst({
      where: { employeeId, relievedAt: null },
    });

    // Office admin can only release employees from their own office
    if (role === "officeadmin") {
      const myOfficeId = await getUserOfficeId(session.user.id);
      const employeeOfficeId =
        currentPosting?.officeId ??
        (await prisma.employee.findUnique({ where: { id: employeeId }, select: { officeId: true } }))?.officeId;

      if (!myOfficeId || employeeOfficeId !== myOfficeId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Resolve grade for the new posting
    let newGrade = currentPosting?.grade ?? "0";
    if (newOrgPostId) {
      const orgPost = await prisma.orgPost.findUnique({
        where: { id: Number(newOrgPostId) },
        select: { grade: true },
      });
      if (orgPost?.grade) newGrade = orgPost.grade;
    }

    // Interactive transaction: close current posting (if any) + create new pending posting
    const newPosting = await prisma.$transaction(async (tx) => {
      if (currentPosting) {
        await tx.posting.update({
          where: { id: currentPosting.id },
          data: {
            relievedAt: releasedAt,
            orderNo: orderNo ?? null,
            orderDate: orderDate ?? null,
          },
        });
      }

      return tx.posting.create({
        data: {
          employeeId,
          officeId: Number(newOfficeId),
          orgPostId: newOrgPostId ? Number(newOrgPostId) : null,
          grade: newGrade,
          type: "transfer",
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
    });

    return NextResponse.json(newPosting, { status: 201 });
  } catch (err) {
    console.error("[POST /api/employees/[id]/release]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
