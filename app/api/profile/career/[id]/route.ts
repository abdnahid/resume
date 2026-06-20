import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE — employee can only delete their own self-reported pending postings
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = session.user.username ?? "";
  const id = parseInt((await params).id);

  const posting = await prisma.posting.findUnique({ where: { id } });
  if (!posting || posting.employeeId !== employeeId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!posting.selfReported || posting.status !== "pending") {
    return NextResponse.json({ error: "Cannot delete a verified posting" }, { status: 403 });
  }

  await prisma.posting.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
