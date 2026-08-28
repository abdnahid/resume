import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { resolvePayrollScope } from "@/lib/salary/payroll";
import { getEmployees, getSalaryProcessRecords } from "@/lib/db";
import SalaryProcessTable from "./_components/SalaryProcessTable";

export default async function SalaryPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const role = (session.user as { role?: string })?.role ?? "employee";
  const username = session.user.username ?? "";

  let filter: { officeId?: number; employeeId?: string } | undefined;

  if (role === "officeadmin") {
    // Their office comes from the posting, matching every other payroll screen.
    const scope = await resolvePayrollScope(role, username);
    filter = { officeId: scope?.officeId ?? undefined };
  } else if (role === "employee" || role === "data_entry") {
    // Their own row only. This used to scope the salary records but not the
    // employee list beside them, so the whole roster was rendered.
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
