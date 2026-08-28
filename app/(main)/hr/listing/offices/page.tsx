import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePayrollScope } from "@/lib/salary/payroll";
import OfficeSetup from "./_components/OfficeSetup";

/**
 * Office setup — contact details, house rent zone, and the bank an office draws
 * salary on.
 *
 * A superadmin sees every office; an officeadmin only their own. The route
 * enforces the same, and the house rent zone is superadmin-only even on an
 * officeadmin's own office.
 */
export default async function OfficesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const role = (session.user as { role?: string })?.role ?? "employee";
  const scope = await resolvePayrollScope(role, session.user.username ?? "");
  if (!scope) redirect("/hr/listing");

  const [offices, banks] = await Promise.all([
    prisma.office.findMany({
      where: scope.officeId !== null ? { id: scope.officeId } : undefined,
      include: { bankAccount: { include: { bank: true } } },
      orderBy: { id: "asc" },
    }),
    prisma.bank.findMany({ where: { isActive: true }, orderBy: { nameEn: "asc" } }),
  ]);

  return (
    <OfficeSetup
      offices={offices.map((o) => ({
        id: o.id,
        type: o.type,
        nameEn: o.nameEn,
        nameBn: o.nameBn,
        officeHead: o.officeHead,
        addressEn: o.addressEn,
        addressBn: o.addressBn,
        phone: o.phone,
        email: o.email,
        houseRentZone: o.houseRentZone,
        bank: o.bankAccount
          ? {
              bankId: o.bankAccount.bankId,
              bankNameBn: o.bankAccount.bank.nameBn,
              recipientDesignationBn: o.bankAccount.recipientDesignationBn,
              branchNameBn: o.bankAccount.branchNameBn,
              branchAddressBn: o.bankAccount.branchAddressBn,
              accountNo: o.bankAccount.accountNo,
              isPlaceholder: o.bankAccount.isPlaceholder,
            }
          : null,
      }))}
      banks={banks.map((b) => ({ id: b.id, nameEn: b.nameEn, nameBn: b.nameBn }))}
      isSuperadmin={role === "superadmin"}
    />
  );
}
