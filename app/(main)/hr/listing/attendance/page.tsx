import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { payrollOffices, resolvePayrollScope } from "@/lib/salary/payroll";
import AttendanceRegister from "./_components/AttendanceRegister";

/**
 * Days worked by daily-basis staff.
 *
 * Separate from the pay run on purpose: attendance is a record about a month,
 * not a by-product of paying for it. Scoped like payroll — an officeadmin sees
 * their own office, a superadmin picks.
 */
export default async function AttendancePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string })?.role ?? "employee";
  const scope = await resolvePayrollScope(role, session?.user?.username ?? "");
  if (!scope) redirect("/hr/listing");

  const offices = await payrollOffices(scope);

  return (
    <AttendanceRegister
      offices={offices.map((o) => ({ id: o.id, nameEn: o.nameEn }))}
      pinned={scope.pinned}
    />
  );
}
