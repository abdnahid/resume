import { prisma } from "@/lib/prisma";
import { requireInternal } from "@/lib/auth-guard";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { SidebarProvider } from "@/components/layout/SidebarContext";
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
    <SidebarProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-background print:block print:h-auto print:overflow-visible">
        <Navbar user={user} />
        {/*
          `relative` so the sidebar can be positioned out of flow inside it.
          That is what lets <main> span the whole window and centre its content
          on the same 1440px box the navbar uses — with the sidebar in flow the
          main column started 240px in, and no width could make the two align.
        */}
        <div className="relative flex flex-1 overflow-hidden print:block print:overflow-visible">
          <Sidebar role={role} />
          <main className="flex-1 overflow-y-auto print:overflow-visible">
            {children}
          </main>
        </div>
        <Footer module="hr" audience="internal" />
      </div>
    </SidebarProvider>
  );
}
