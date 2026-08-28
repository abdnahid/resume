import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActiveScale, getSalaryHeads } from "@/lib/salary/queries";
import SalaryHeadManager from "./_components/SalaryHeadManager";

/**
 * The salary head catalogue.
 *
 * Superadmin only — a head created here is offered to every office, so an
 * officeadmin who could invent allowances could raise their own office's pay.
 * The API enforces the same rule; this redirect is the cheap half.
 */
export default async function SalaryHeadsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string })?.role ?? "employee";
  if (role !== "superadmin") redirect("/hr/listing");

  const [heads, scale] = await Promise.all([getSalaryHeads(), getActiveScale()]);

  return <SalaryHeadManager heads={heads} scale={scale} />;
}
