import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAssignableRole, type AssignableRole } from "@/lib/roles";

/**
 * Assign a role to an employee. Superadmin only.
 *
 * The `[id]` is the **employee id**, not the user id — that is what an
 * administrator knows and what every other screen is keyed on.
 */

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (
    !session ||
    (session.user as { accountType?: string }).accountType !== "INTERNAL"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if ((session.user as { role?: string }).role !== "superadmin") {
    return NextResponse.json(
      { error: "Only a superadmin can assign roles." },
      { status: 403 },
    );
  }

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const role = String(body.role);
  if (!isAssignableRole(role)) {
    return NextResponse.json({ error: `Unknown role "${role}".` }, { status: 400 });
  }
  const assigned: AssignableRole = role;

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { id: true, nameEn: true, userId: true, user: { select: { role: true } } },
  });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // ── You cannot demote yourself ───────────────────────────────────────────
  // Role assignment is itself superadmin-only, so a superadmin who removes
  // their own role loses the ability to restore it. With one superadmin on the
  // roster that locks everybody out of the system permanently.
  const actingUsername = session.user.username ?? "";
  if (employee.id === actingUsername && role !== "superadmin") {
    return NextResponse.json(
      {
        error:
          "You cannot remove your own superadmin role — only a superadmin can assign roles, so you would not be able to restore it. Have another superadmin do it.",
      },
      { status: 409 },
    );
  }

  // ── Never leave the system without a superadmin ─────────────────────────
  if (employee.user?.role === "superadmin" && role !== "superadmin") {
    const others = await prisma.user.count({
      where: { role: "superadmin", id: { not: employee.userId } },
    });
    if (others === 0) {
      return NextResponse.json(
        { error: "This is the only superadmin. Promote someone else before demoting them." },
        { status: 409 },
      );
    }
  }

  await prisma.user.update({ where: { id: employee.userId }, data: { role } });

  return NextResponse.json({
    employeeId: employee.id,
    name: employee.nameEn,
    from: employee.user?.role ?? null,
    to: assigned,
  });
}
