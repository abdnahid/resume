import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
      user: { select: { role: true } },
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
        designationBn: e.designationBn,
        category: e.category,
        role: e.user?.role ?? "employee",
        officeId: e.office.id,
        officeName: e.office.nameEn,
      }))}
    />
  );
}
