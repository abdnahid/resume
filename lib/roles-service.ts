/**
 * Granting and removing roles — the server half.
 *
 * **A person may hold several** (D122). One column was accepted deliberately in
 * D57, on the reading that payroll authority and file-routing authority are
 * different jobs and therefore different people; the client corrected that on
 * 2026-09-10. Rarely but really, one person is the office admin, the office
 * head and the lab entry officer at once — and with a single column, granting
 * the second silently removed the first. `import:office-heads` had to move
 * `officeadmin` to another desk at 14 of 23 offices to work around it.
 *
 * `User.roles` is the authority; `User.role` is the highest-precedence member,
 * kept in step **here and nowhere else** so the two cannot drift.
 */
import { prisma } from "@/lib/prisma";
import { isAssignableRole, primaryRole, type AssignableRole } from "@/lib/roles";

export type SetRolesResult = {
  employeeId: string;
  name: string;
  from: string[];
  to: AssignableRole[];
};

/**
 * Replace somebody's roles with exactly this set.
 *
 * Replaced rather than added to, for the reason team members are (D—): a set
 * diffed on save leaves somebody holding a role because nobody remembered to
 * take it off. The screen sends the whole set every time.
 */
export async function setRoles(args: {
  employeeId: string;
  roles: string[];
  /** The employee id of whoever is doing this, for the self-demotion guard. */
  actingEmployeeId: string;
}): Promise<SetRolesResult> {
  const wanted = [...new Set(args.roles)].filter(isAssignableRole);
  if (!wanted.length)
    throw new Error("Everyone holds at least one role — choose Employee to clear the rest.");

  const employee = await prisma.employee.findUnique({
    where: { id: args.employeeId },
    select: {
      id: true, nameEn: true, userId: true,
      user: { select: { role: true, roles: true } },
    },
  });
  if (!employee?.userId || !employee.user) throw new Error("Employee not found");
  const held = employee.user.roles.length ? employee.user.roles : [employee.user.role];

  // ── You cannot demote yourself ─────────────────────────────────────────
  // Role assignment is itself superadmin-only, so a superadmin who removes
  // their own loses the ability to restore it. With one superadmin on the
  // roster that locks everybody out permanently.
  if (employee.id === args.actingEmployeeId && !wanted.includes("superadmin"))
    throw new Error(
      "You cannot remove your own superadmin role — only a superadmin can assign roles, so you could not restore it. Have another superadmin do it.",
    );

  // ── Never leave the system without a superadmin ────────────────────────
  if (held.includes("superadmin") && !wanted.includes("superadmin")) {
    const others = await prisma.user.count({
      where: { roles: { has: "superadmin" }, id: { not: employee.userId } },
    });
    if (others === 0)
      throw new Error(
        "This is the only superadmin. Promote someone else before demoting them.",
      );
  }

  await prisma.user.update({
    where: { id: employee.userId },
    // `role` is derived from the set, here and nowhere else.
    data: { roles: wanted, role: primaryRole(wanted) },
  });

  return { employeeId: employee.id, name: employee.nameEn, from: held, to: wanted };
}
