import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEmployees } from "@/lib/db";
import { getDailyRates } from "@/lib/salary/queries";
import { rateFor, MAX_PAID_DAYS } from "@/lib/salary/daily";
import {
  activeFixationCounts,
  payrollOffices,
  processedMonths,
  resolvePayrollScope,
} from "@/lib/salary/payroll";
import SalaryFixationTable from "./_components/SalaryFixationTable";

export default async function FixationPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string })?.role ?? "employee";
  if (role !== "superadmin" && role !== "officeadmin") redirect("/hr/listing");

  const username = session?.user?.username ?? "";
  const scope = await resolvePayrollScope(role, username);
  if (!scope) redirect("/hr/listing");

  const officeId = scope.officeId ?? undefined;

  const [employees, offices] = await Promise.all([
    getEmployees(officeId !== undefined ? { officeId } : undefined),
    payrollOffices(scope),
  ]);

  // Daily-basis staff hold no fixation, so the table shows their rate instead.
  // It follows the office zone, which is why it is resolved here rather than
  // stored per employee.
  const [rates, officeZones] = await Promise.all([
    getDailyRates(),
    prisma.office.findMany({ select: { id: true, houseRentZone: true } }),
  ]);
  const rateByOffice = new Map(
    officeZones.map((o) => [o.id, rateFor(rates, o.houseRentZone)]),
  );

  // How many staff each office would actually pay, so the modal can say so
  // before a run rather than after it.
  const activeByOffice = await activeFixationCounts(offices.map((o) => o.id));

  // Every month already processed, per office — the modal's month grid, and
  // what makes an out-of-order run refusable.
  const processed = (
    await Promise.all(
      offices.map(async (o) => {
        const months = await processedMonths(o.id);
        return months.map((m) => ({
          month: m.month,
          year: m.year,
          officeId: o.id,
          count: m.employeeCount,
          hasAdvice: m.hasAdvice,
        }));
      }),
    )
  ).flat();

  return (
    <SalaryFixationTable
      employees={employees}
      offices={offices.map((o) => ({
        id: o.id,
        nameEn: o.nameEn,
        activeCount: activeByOffice.get(o.id) ?? 0,
      }))}
      processed={processed}
      pinned={scope.pinned}
      dailyRates={Object.fromEntries(rateByOffice)}
      maxPaidDays={MAX_PAID_DAYS}
    />
  );
}
