import { prisma } from "@/lib/prisma";
import { requireInternal } from "@/lib/auth-guard";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import type { SessionUser } from "@/components/layout/Navbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireInternal("/hr");

  const employeeId = viewer.employeeId ?? "";
  const role = viewer.role;

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
    nameBn: employee?.nameBn ?? viewer.name,
    nameEn: employee?.nameEn ?? viewer.name,
    designationBn: employee?.designationBn ?? "",
    designationEn: employee?.designationEn ?? "",
    officeBn: employee?.office.nameBn ?? "",
    officeEn: employee?.office.nameEn ?? "",
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background print:block print:h-auto print:overflow-visible">
      <Navbar user={user} />
      <div className="flex flex-1 overflow-hidden print:block print:overflow-visible">
        <Sidebar role={role} />
        <main className="flex-1 overflow-y-auto print:overflow-visible">{children}</main>
      </div>
      <Footer module="hr" audience="internal" />
    </div>
  );
}
