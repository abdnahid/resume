import { notFound } from "next/navigation";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor, canViewApplication } from "@/lib/workflow/inbox";
import { getApplication } from "@/lib/cm/applications";
import { planFor } from "@/lib/cm/inspection";
import { orgForOffice } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { toBengaliDigits } from "@/lib/bengali";
import OrderDocument from "./OrderDocument";

export const dynamic = "force-dynamic";

/**
 * The office order as an official letter (D85).
 *
 * Its own route rather than a panel, because it is a document: it prints, it
 * downloads, and Puppeteer renders this very page for the PDF — the salary
 * slip's arrangement, so there is no second layout to keep in step.
 *
 * **Only exists once the plan is approved.** The order number is assigned then
 * (D82), so before that there is no letter to show and this 404s rather than
 * rendering a blank form.
 */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const applicationId = Number(id);
  if (!Number.isInteger(applicationId)) notFound();

  const viewer = await requireInternal(`/workflow/${id}/order`);
  const actor = await actorFor(viewer);
  if (!(await canViewApplication(actor, applicationId))) notFound();

  const [app, plan] = await Promise.all([getApplication(applicationId), planFor(applicationId)]);
  if (!app || !plan?.approvedAt || !plan.orderNo) notFound();

  // Bengali digits throughout, as the bank advice does — a government letter
  // with Arabic numerals in the date reads as a draft.
  const bnDate = (d: Date) =>
    toBengaliDigits(
      d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }),
    );

  // The issuing office's own name, address and email — `getApplication` selects
  // only the names, and a letter from Barishal carrying the Dhaka address would
  // be wrong on its face.
  const office = app.bstiOfficeId
    ? await prisma.office.findUnique({
        where: { id: app.bstiOfficeId },
        select: { nameBn: true, addressBn: true, email: true },
      })
    : null;
  const org = orgForOffice({
    nameBn: office?.nameBn ?? "প্রধান কার্যালয়, বিএসটিআই, ঢাকা",
    addressBn: office?.addressBn ?? "",
    email: office?.email ?? null,
  });

  return (
    <OrderDocument
      org={org}
      pdfHref={`/api/workflow/applications/${applicationId}/order/pdf`}
      order={{
        orderNo: toBengaliDigits(plan.orderNo),
        approvedOn: bnDate(plan.approvedAt),
        approvedBy: {
          name: plan.approvedBy?.nameEn ?? "",
          designation: plan.approvedBy?.designationBn ?? plan.approvedBy?.designationEn ?? null,
        },
        proposedBy: {
          name: plan.proposedBy.nameEn,
          designation: plan.proposedBy.designationBn ?? plan.proposedBy.designationEn ?? null,
        },
        scheduledOn: bnDate(plan.scheduledOn),
        note: plan.note,
        applicationNo: app.applicationNo,
        product: app.product
          ? { serial: app.product.serial, nameEn: app.product.nameEn, nameBn: app.product.nameBn }
          : null,
        subProducts: app.subProducts.map((sp) => sp.subProduct.nameEn),
        company: {
          nameEn: app.organization.nameEn,
          nameBn: app.organization.nameBn,
          address: [app.organization.addressLine, app.organization.district]
            .filter(Boolean)
            .join(", ") || null,
        },
        factory: {
          nameEn: app.factory.nameEn,
          nameBn: app.factory.nameBn,
          district: app.factory.district,
        },
        team: plan.members.map((m) => ({
          name: m.employee.nameEn,
          designation: m.employee.designationBn ?? m.employee.designationEn,
          role: m.role,
        })),
      }}
    />
  );
}
