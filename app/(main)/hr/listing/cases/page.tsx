import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCases } from "@/lib/salary/cases";
import { getEmployees } from "@/lib/db";
import { getSalaryHeads } from "@/lib/salary/queries";
import CaseManager from "./_components/CaseManager";

/**
 * The case register.
 *
 * Case officers reach every office — cases are run by a central legal cell, not
 * per office. Superadmin can do the same. The API enforces this too; the
 * redirect is the cheap half.
 */
export default async function CasesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string })?.role ?? "employee";
  if (role !== "superadmin" && role !== "case_officer") redirect("/hr/listing");

  const [cases, employees, heads] = await Promise.all([
    getCases(),
    getEmployees(),
    getSalaryHeads({ activeOnly: true }),
  ]);

  return (
    <CaseManager
      cases={cases}
      heads={heads}
      employees={employees.map((e) => ({
        id: e.id,
        nameBn: e.name.bn,
        nameEn: e.name.en,
        office: e.current_job.office_bn,
      }))}
    />
  );
}
