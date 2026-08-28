import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPayslip } from "@/lib/salary/slip";
import { resolvePayrollScope } from "@/lib/salary/payroll";
import PayslipDocument from "./_components/PayslipDocument";

/**
 * One employee's salary slip for one month.
 *
 * Scoped the same way the processed-salary list is: a superadmin sees any, an
 * officeadmin only their own office, and anyone else only their own slip.
 * `getPayslip()` enforces it — a slip outside the caller's scope reads as
 * missing rather than forbidden, so nothing is revealed about other offices.
 */
export default async function PayslipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { id } = await params;
  const { month, year } = await searchParams;
  if (!month || !year) notFound();

  const role = (session.user as { role?: string })?.role ?? "employee";
  const username = session.user.username ?? "";

  let scope: { officeId?: number | null; employeeId?: string } | undefined;
  if (role === "officeadmin") {
    const s = await resolvePayrollScope(role, username);
    scope = { officeId: s?.officeId ?? -1 };
  } else if (role !== "superadmin") {
    scope = { employeeId: username };
  }

  const slip = await getPayslip(id, month, year, scope);
  if (!slip) notFound();

  return <PayslipDocument slip={slip} />;
}
