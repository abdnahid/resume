import { notFound } from "next/navigation";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor, canViewApplication } from "@/lib/workflow/inbox";
import { getApplication } from "@/lib/cm/applications";
import { planFor } from "@/lib/cm/inspection";
import { reportFor, inspectionAudience } from "@/lib/cm/inspection-report";
import { INSPECTION_CONDITIONS, INSPECTION_MARKINGS, INSPECTION_NARRATIVE } from "@/lib/cm/policy";
import { orgForOffice } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { toBengaliDigits } from "@/lib/bengali";
import ReportDocument from "./ReportDocument";

export const dynamic = "force-dynamic";

/**
 * The inspection report as the printed document (D86).
 *
 * Readable once it has been **sent up**, not only once approved: the senior who
 * has to approve it needs to read it as a document, and a letter that only
 * exists after approval cannot be approved on its evidence.
 */
export default async function InspectionReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const applicationId = Number(id);
  if (!Number.isInteger(applicationId)) notFound();

  const viewer = await requireInternal(`/workflow/${id}/inspection-report`);
  const actor = await actorFor(viewer);
  if (!(await canViewApplication(actor, applicationId))) notFound();

  const [app, report, plan] = await Promise.all([
    getApplication(applicationId),
    reportFor(applicationId),
    planFor(applicationId),
  ]);
  if (!app || !report || !(report.submittedAt || report.approvedAt)) notFound();

  // The same rule the panel uses (D90): a draft is the officer's, a sent report
  // is the approver's, an approved one is the chain's.
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
    toBengaliDigits(d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }));
  const label = (list: readonly { key: string; labelBn: string }[], key: string) =>
    list.find((x) => x.key === key)?.labelBn ?? key;

  return (
    <ReportDocument
      org={org}
      pdfHref={`/api/workflow/applications/${applicationId}/inspection-report/pdf`}
      report={{
        reportNo: report.reportNo ? toBengaliDigits(report.reportNo) : null,
        approvedOn: report.approvedAt ? bnDate(report.approvedAt) : bnDate(report.preparedAt),
        preparedBy: {
          name: report.preparedBy.nameEn,
          designation: report.preparedBy.designationBn ?? report.preparedBy.designationEn ?? null,
        },
        approvedBy: report.approvedBy
          ? {
              name: report.approvedBy.nameEn,
              designation: report.approvedBy.designationBn ?? report.approvedBy.designationEn ?? null,
            }
          : null,
        inspectedOn: plan ? bnDate(plan.scheduledOn) : null,
        orderNo: plan?.orderNo ? toBengaliDigits(plan.orderNo) : null,
        applicationNo: app.applicationNo,
        product: app.product?.nameBn ?? app.product?.nameEn ?? null,
        standards: app.product?.standards.map((ps) => ps.bds.number) ?? [],
        applicant:
          [report.applicantName, report.applicantDesignation].filter(Boolean).join(", ") || null,
        company: app.organization.nameBn ?? app.organization.nameEn,
        companyAddress:
          [app.organization.addressLine, app.organization.district].filter(Boolean).join(", ") || null,
        factory: app.factory.nameBn ?? app.factory.nameEn,
        factoryAddress: app.factory.district,
        govtApprovalOk: report.govtApprovalOk,
        govtApprovalNote: report.govtApprovalNote,
        declaredCapacity: app.production
          ? `${toBengaliDigits(String(app.production.annualCapacityValue))} ${app.production.capacityUnit.code}`
          : null,
        foundCapacity:
          report.foundCapacityValue !== null && report.foundCapacityUnit
            ? `${toBengaliDigits(String(report.foundCapacityValue))} ${report.foundCapacityUnit.code}`
            : null,
        utilisationPercent:
          report.utilisationPercent === null ? null : String(report.utilisationPercent),
        unitCostTaka: report.unitCostPoisha === null ? null : String(report.unitCostPoisha / 100),
        remarks: report.remarks,
        team:
          plan?.members.map((m) => ({
            name: m.employee.nameEn,
            designation: m.employee.designationBn ?? m.employee.designationEn ?? null,
          })) ?? [],
        conditions: report.conditions.map((c) => ({
          labelBn: label(INSPECTION_CONDITIONS, c.key),
          satisfactory: c.satisfactory,
          note: c.note,
        })),
        markings: report.markings.map((m) => ({
          labelBn: label(INSPECTION_MARKINGS, m.key),
          present: m.present,
        })),
        narrative: report.answers.map((a) => ({
          labelBn: label(INSPECTION_NARRATIVE, a.key),
          text: a.text,
        })),
      }}
    />
  );
}
