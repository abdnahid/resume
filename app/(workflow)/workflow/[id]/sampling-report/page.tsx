import { notFound } from "next/navigation";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor, canViewApplication } from "@/lib/workflow/inbox";
import { getApplication } from "@/lib/cm/applications";
import { planFor } from "@/lib/cm/inspection";
import { reportFor, inspectionAudience } from "@/lib/cm/inspection-report";
import { samplingBoxesFor } from "@/lib/cm/sampling-report";
import { orgForOffice } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { toBengaliDigits } from "@/lib/bengali";
import SamplingReportDocument from "./SamplingReportDocument";

export const dynamic = "force-dynamic";

/**
 * The sampling report as the printed document (D96).
 *
 * Same standing rule as the inspection report it travels with (D90/D92) —
 * readable once sent up, because the senior approving it reads it as a
 * document, and approved by the same act.
 */
export default async function SamplingReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const applicationId = Number(id);
  if (!Number.isInteger(applicationId)) notFound();

  const viewer = await requireInternal(`/workflow/${id}/sampling-report`);
  const actor = await actorFor(viewer);
  if (!(await canViewApplication(actor, applicationId))) notFound();

  const [app, report, plan, boxes] = await Promise.all([
    getApplication(applicationId),
    reportFor(applicationId),
    planFor(applicationId),
    samplingBoxesFor(applicationId),
  ]);
  if (!app || !report || !(report.submittedAt || report.approvedAt)) notFound();
  // Nothing sealed is not an empty report — it is no report at all.
  if (!boxes.length) notFound();

  const audience = inspectionAudience({
    visitingOfficerId: plan?.proposedByEmployeeId ?? null,
    holderEmployeeId: app.holderEmployeeId,
    viewerEmployeeId: actor.employeeId,
    viewerRole: actor.role,
    submittedAt: report.submittedAt,
    approvedAt: report.approvedAt,
  });
  if (audience === "none") notFound();

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

  const bnDate = (d: Date) =>
    toBengaliDigits(
      d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }),
    );

  return (
    <SamplingReportDocument
      org={org}
      pdfHref={`/api/workflow/applications/${applicationId}/sampling-report/pdf`}
      report={{
        // The inspection report's number, not one of its own (D96).
        reportNo: report.reportNo ? toBengaliDigits(report.reportNo) : null,
        approvedOn: report.approvedAt ? bnDate(report.approvedAt) : bnDate(report.preparedAt),
        preparedBy: {
          name: report.preparedBy.nameEn,
          designation: report.preparedBy.designationBn ?? report.preparedBy.designationEn ?? null,
        },
        approvedBy: report.approvedBy
          ? {
              name: report.approvedBy.nameEn,
              designation:
                report.approvedBy.designationBn ?? report.approvedBy.designationEn ?? null,
            }
          : null,
        inspectedOn: plan ? bnDate(plan.scheduledOn) : null,
        orderNo: plan?.orderNo ? toBengaliDigits(plan.orderNo) : null,
        applicationNo: app.applicationNo,
        product: app.product?.nameBn ?? app.product?.nameEn ?? null,
        company: app.organization.nameBn ?? app.organization.nameEn,
        factory: app.factory.nameBn ?? app.factory.nameEn,
        factoryDistrict: app.factory.district,
        remarks: report.samplingRemarks,
        boxes,
      }}
    />
  );
}
