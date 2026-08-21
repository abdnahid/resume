import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEmployees, getSalaryProcessRecords } from "@/lib/db";
import SalaryProcessTable from "./_components/SalaryProcessTable";

export default async function SalaryPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const role = (session.user as { role?: string })?.role ?? "employee";
  const username = session.user.username ?? "";

  let filter: { officeId?: number; employeeId?: string } | undefined;

  if (role === "officeadmin") {
    const emp = await prisma.employee.findUnique({
      where: { id: username },
      select: { officeId: true },
    });
    filter = { officeId: emp?.officeId ?? undefined };
  } else if (role === "employee" || role === "data_entry") {
    filter = { employeeId: username };
  }
  // superadmin: filter stays undefined → all records

  const [employees, salaryProcesses] = await Promise.all([
    getEmployees(filter),
    getSalaryProcessRecords(filter),
  ]);

  return (
    <SalaryProcessTable
      employees={employees}
      salaryProcesses={salaryProcesses}
      role={role}
    />
  );
}
