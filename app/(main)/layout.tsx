import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import type { SessionUser } from "@/components/layout/Navbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const employeeId = session.user.username ?? "";
  const role = (session.user as { role?: string }).role ?? "employee";

  // Pull only what the Navbar needs — no heavy relations
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      nameBn: true,
      nameEn: true,
      designationBn: true,
      designationEn: true,
      office: { select: { nameBn: true, nameEn: true } },
    },
  });

  const user: SessionUser = {
    employeeId,
    role,
    nameBn: employee?.nameBn ?? session.user.name,
    nameEn: employee?.nameEn ?? session.user.name,
    designationBn: employee?.designationBn ?? "",
    designationEn: employee?.designationEn ?? "",
    officeBn: employee?.office.nameBn ?? "",
    officeEn: employee?.office.nameEn ?? "",
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar user={user} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
