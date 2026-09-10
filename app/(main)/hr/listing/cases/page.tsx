import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCases } from "@/lib/salary/cases";
import { getViewer } from "@/lib/auth-guard";
import { hasAnyRole } from "@/lib/roles";
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
  // **`getViewer()`, not the session.** The cookie carries the primary role
  // only, and a case officer who is also an office admin has `officeadmin` as
  // theirs — so the session would refuse them their own register (D122).
  const viewer = await getViewer();
  if (!hasAnyRole(viewer, "superadmin", "case_officer")) redirect("/hr/listing");

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
