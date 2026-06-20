import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "superadmin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const action = body.action as "approve" | "revision";
  const note = body.note as string | undefined;

  if (action === "approve") {
    await prisma.employee.update({
      where: { id },
      data: {
        profileStatus: "approved",
        profileApprovedAt: new Date(),
        profileApprovedBy: session.user.username ?? session.user.id,
        profileRevisionNote: null,
      },
    });
  } else if (action === "revision") {
    await prisma.employee.update({
      where: { id },
      data: {
        profileStatus: "needs_revision",
        profileRevisionNote: note ?? null,
      },
    });
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
