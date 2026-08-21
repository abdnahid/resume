import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEmployees } from "@/lib/db";
import { getIdCardBatches, getCurrentDirectorGeneral } from "@/lib/id-card";
import IdCardManager from "./_components/IdCardManager";

export default async function IdCardsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const role = (session.user as { role?: string })?.role ?? "employee";
  if (role !== "superadmin") redirect("/hr/listing");

  const [batches, employees, currentDg] = await Promise.all([
    getIdCardBatches(),
    getEmployees(),
    getCurrentDirectorGeneral(),
  ]);

  const employeeOptions = employees.map((e) => ({
    id: e.id,
    nameBn: e.name.bn,
    nameEn: e.name.en,
    designationBn: e.current_job.designation_bn,
    officeBn: e.current_job.office_bn,
  }));

  return (
    <IdCardManager
      batches={batches}
      employees={employeeOptions}
      currentDg={
        currentDg
          ? { name: currentDg.name, hasSignature: !!currentDg.signatureUrl }
          : null
      }
    />
  );
}
