import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return false;
  const role = (session.user as { role?: string }).role ?? "";
  return role === "superadmin" || role === "officeadmin";
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = parseInt((await params).id);
  const body = await req.json();
  const allowed = ["orgPostId", "officeId", "grade", "joinedAt", "relievedAt", "orderNo", "orderDate", "remarks", "type"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key] === "" ? null : body[key];
  }

  const posting = await prisma.posting.update({
    where: { id },
    data,
    include: {
      orgPost: { include: { unit: { include: { parent: true } } } },
      office: true,
    },
  });
  return NextResponse.json(posting);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = parseInt((await params).id);
  await prisma.posting.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
