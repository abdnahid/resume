import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { displayDesignation } from "@/lib/workflow/chain";
import RoleManager from "./_components/RoleManager";

/**
 * Who holds which role. Superadmin only — this screen grants the power to reach
 * every other screen.
 */
export default async function RolesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string })?.role ?? "employee";
  if (role !== "superadmin") redirect("/hr/listing");

  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      nameEn: true,
      nameBn: true,
      designationBn: true,
      category: true,
      // The desk is the job where somebody has confirmed the seat (D124), so
      // the title shown here is `displayDesignation()`'s and not the raw
      // record — which is where the two were seen to disagree.
      orgPostIsInferred: true,
      orgPost: { select: { nameBn: true } },
      actingOrgPost: { select: { nameBn: true } },
      user: { select: { role: true, roles: true } },
      office: { select: { id: true, nameEn: true } },
    },
    orderBy: { id: "asc" },
  });

  const offices = await prisma.office.findMany({
    select: { id: true, nameEn: true },
    orderBy: { id: "asc" },
  });

  return (
    <RoleManager
      me={session?.user?.username ?? ""}
      offices={offices}
      employees={employees.map((e) => ({
        id: e.id,
        nameEn: e.nameEn,
        nameBn: e.nameBn,
        designationBn:
          displayDesignation(
            e.designationBn,
            (e.actingOrgPost ?? e.orgPost)?.nameBn ?? null,
            e.actingOrgPost !== null,
            e.actingOrgPost === null && e.orgPostIsInferred,
          ) ?? e.designationBn,
        category: e.category,
        role: e.user?.role ?? "employee",
        roles: e.user?.roles?.length ? e.user.roles : [e.user?.role ?? "employee"],
        officeId: e.office.id,
        officeName: e.office.nameEn,
      }))}
    />
  );
}
