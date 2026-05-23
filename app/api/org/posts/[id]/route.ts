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
  const allowed = ["nameEn", "nameBn", "sanctionedCount", "sortOrder", "isActive"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  const post = await prisma.orgPost.update({ where: { id }, data });
  return NextResponse.json(post);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = parseInt((await params).id);

  const hasEmployees = await prisma.employee.findFirst({ where: { orgPostId: id } });
  if (hasEmployees) {
    return NextResponse.json(
      { error: "Employees are assigned to this post — reassign them first" },
      { status: 409 },
    );
  }

  await prisma.orgPost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
