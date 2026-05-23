import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ASSIGNABLE_ROLES = ["officeadmin", "data_entry", "employee"] as const;

// PATCH /api/users/[id]/role
// Body: { role }
// Superadmin only. Cannot elevate to superadmin via this endpoint.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const newRole = body.role;

  if (!ASSIGNABLE_ROLES.includes(newRole)) {
    return NextResponse.json(
      { error: `Role must be one of: ${ASSIGNABLE_ROLES.join(", ")}` },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role: newRole },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json(user);
}
