import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireSuperAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return false;
  const role = (session.user as { role?: string }).role ?? "";
  return role === "superadmin";
}

const PERSON_FIELDS = [
  "nameEn", "nameBn",
  "fatherNameEn", "fatherNameBn",
  "motherNameEn", "motherNameBn",
  "dateOfBirth", "gender", "maritalStatus",
  "bloodGroup", "nid", "status",
  "email", "mobileHome", "mobileOffice",
  "dateOfJoining", "initialDesignationBn",
] as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const exists = await prisma.employee.findUnique({ where: { id } });
  if (!exists) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  for (const key of PERSON_FIELDS) {
    if (key in body) data[key] = body[key];
  }
  if (body.officeId != null) data.officeId = Number(body.officeId);

  // Mirror common identity into the linked User row so it stays in sync.
  const userData: Record<string, unknown> = {};
  if (typeof body.nameEn === "string") userData.name = body.nameEn;
  if (typeof body.email === "string" && body.email.trim()) {
    userData.email = body.email.trim();
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id }, data });
      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id: exists.userId },
          data: { ...userData, updatedAt: new Date() },
        });
      }
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ id }, { status: 200 });
}
