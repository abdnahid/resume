import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const role = (session.user as { role?: string }).role ?? "";
  return role === "superadmin" || role === "officeadmin" ? session : null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = parseInt((await params).id);
  const body = await req.json();

  const allowed = ["nameEn", "nameBn", "category", "parentId", "sortOrder", "isActive"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  const unit = await prisma.orgUnit.update({ where: { id }, data });
  return NextResponse.json(unit);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = parseInt((await params).id);

  const childCount = await prisma.orgUnit.count({ where: { parentId: id } });
  if (childCount > 0) {
    return NextResponse.json(
      { error: "Remove all child units first" },
      { status: 409 },
    );
  }

  const occupiedPost = await prisma.orgPost.findFirst({
    where: { unitId: id, employees: { some: {} } },
  });
  if (occupiedPost) {
    return NextResponse.json(
      { error: "Unit has posts with employees assigned — reassign them first" },
      { status: 409 },
    );
  }

  await prisma.orgUnit.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
