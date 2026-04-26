import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getBankAdvices, getSalaryProcessMonths } from "@/lib/db";
import BankAdviceTable from "./_components/BankAdviceTable";

export default async function BankAdvicePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const role = (session.user as { role?: string })?.role ?? "employee";

  const [bankAdvices, salaryMonths] = await Promise.all([
    getBankAdvices(),
    getSalaryProcessMonths(),
  ]);

  return (
    <BankAdviceTable
      bankAdvices={bankAdvices}
      salaryMonths={salaryMonths}
      role={role}
    />
  );
}
