import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth-guard";
import { hasRole } from "@/lib/roles";
import { designationCatalogue } from "@/lib/designation-service";
import DesignationManager from "./_components/DesignationManager";

export const dynamic = "force-dynamic";

/**
 * The employee designation catalogue — the title half of D149.
 *
 * **What it is for.** The roster's `designation` is free text out of the HR
 * export and 729 active employees carry 84 distinct values, a tenth of them the
 * same job written twice — *Examiner* and *পরীক্ষক*, *Lab Attendant* and *Lab
 * attendant*, *Stenographer* and *Stenoghrapher*. Every variant is its own rank
 * on every picker in the system, so an office's Examiners appear as two groups
 * and no screen can be trusted to list them all.
 *
 * **Not the organogram.** Posts are created and edited at
 * `/hr/organogram/manage`, which is the client's own instrument — *"Organogram
 * is the desk"*. This screen is the employee's recorded title, and the one
 * place the two meet is the *no post of this rank* column, which is what says
 * why 285 people cannot be seated correctly.
 *
 * Superadmin only: a designation decides a rank, a rank decides who may sign a
 * test report, so this is not a label anyone may edit.
 */
export default async function DesignationsPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.accountType !== "INTERNAL") redirect("/");
  if (!hasRole(viewer, "superadmin")) redirect("/hr/listing");

  const catalogue = await designationCatalogue();
  return <DesignationManager catalogue={catalogue} />;
}
