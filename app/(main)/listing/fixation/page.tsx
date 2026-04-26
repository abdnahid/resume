import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEmployees, getSalaryProcessRecords } from "@/lib/db";
import SalaryFixationTable from "./_components/SalaryFixationTable";

const MONTH_IDX: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4,
  May: 5, June: 6, July: 7, August: 8,
  September: 9, October: 10, November: 11, December: 12,
};

export default async function FixationPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string })?.role ?? "employee";
  if (role !== "superadmin" && role !== "officeadmin") redirect("/listing");

  const username = session?.user?.username ?? "";

  let officeId: number | undefined;
  if (role === "officeadmin") {
    const emp = await prisma.employee.findUnique({
      where: { id: username },
      select: { officeId: true },
    });
    officeId = emp?.officeId ?? undefined;
  }

  const [employees, salaryProcesses] = await Promise.all([
    getEmployees(officeId !== undefined ? { officeId } : undefined),
    getSalaryProcessRecords(officeId !== undefined ? { officeId } : undefined),
  ]);

  // Find the most recent processed month
  let lastProcessed: { month: string; year: string } | null = null;
  for (const r of salaryProcesses) {
    if (!lastProcessed) { lastProcessed = r; continue; }
    const ry = Number(r.year), ly = Number(lastProcessed.year);
    const rm = MONTH_IDX[r.month], lm = MONTH_IDX[lastProcessed.month];
    if (ry > ly || (ry === ly && rm > lm)) lastProcessed = r;
  }

  return (
    <SalaryFixationTable employees={employees} lastProcessed={lastProcessed} />
  );
}
