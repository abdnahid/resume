import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getBankAdvices, getSalaryProcessMonths } from "@/lib/db";
import { payrollOffices, resolvePayrollScope } from "@/lib/salary/payroll";
import BankAdviceTable from "./_components/BankAdviceTable";

export default async function BankAdvicePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const role = (session.user as { role?: string })?.role ?? "employee";
  const scope = await resolvePayrollScope(role, session.user.username ?? "");

  // A viewer with no payroll role still sees the register, read-only, scoped to
  // nothing in particular — generation is gated in the table and the route.
  const officeId = scope?.officeId ?? undefined;

  const [bankAdvices, salaryMonths, offices] = await Promise.all([
    getBankAdvices(officeId !== undefined ? { officeId } : undefined),
    getSalaryProcessMonths(officeId !== undefined ? { officeId } : undefined),
    scope ? payrollOffices(scope) : Promise.resolve([]),
  ]);

  return (
    <BankAdviceTable
      bankAdvices={bankAdvices}
      salaryMonths={salaryMonths}
      offices={offices}
      pinned={scope?.pinned ?? true}
      role={role}
    />
  );
}
