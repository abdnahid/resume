import { notFound } from "next/navigation";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor } from "@/lib/workflow/inbox";
import { canViewOrder } from "@/lib/labs/board";
import { labActorFor, labDesksOfOffice } from "@/lib/labs/testing";
import {
  conformsLine, demoLabRegNo, demoLabReferenceNo, disciplineOfOrder, reportDocument, reportRows,
  wingTitle,
} from "@/lib/labs/report-document";
import { limitForReport } from "@/lib/labs/limits";
import { declaredLimitsForOrder, declaredKey } from "@/lib/cm/declared-limits";
import ReportDocument from "./ReportDocument";

export const dynamic = "force-dynamic";

/**
 * The test report, at any stage (D145).
 *
 * **Access is the order's** — `canViewOrder()`, the same question every other
 * lab screen asks, and a refusal is `notFound()` (D71). Everyone with standing
 * on the order may read it: the testing officer previewing what he is about to
 * send up, each desk above him reading what it is being asked to sign, and the
 * wing head deciding whether to approve. A document only readable once approved
 * cannot be checked before it is.
 */
export default async function TestReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();

  const viewer = await requireInternal(`/workflow/work-order/${id}/report`);
  const actor = labActorFor(await actorFor(viewer));
  if (!(await canViewOrder(actor, orderId))) notFound();

  const order = await reportDocument(orderId);
  if (!order?.office) notFound();

  const declared = await declaredLimitsForOrder(orderId);
  const rows = reportRows(order.items, declared, limitForReport, declaredKey);
  const conforms = conformsLine(rows);

  const day = (d: Date | null | undefined) =>
    d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : null;

  // The wing each signatory sits in, for the seal — the same source the
  // pass-down is scoped by (D142), so a seal never names a wing the person is
  // not in.
  const desks = await labDesksOfOffice(order.office.id);
  const wingOf = (name: string | undefined) => {
    const d = desks.find((x) => x.nameEn === name);
    return d?.wing ? `${d.wing[0].toUpperCase()}${d.wing.slice(1)} Testing Wing` : null;
  };
  const designationOf = (name: string | undefined) =>
    desks.find((x) => x.nameEn === name)?.designation ?? null;

  const r = order.report;
  const officeName = order.office?.nameEn ?? "";
  const seal = (label: string, who: { nameEn: string } | null | undefined, at: Date | null) => ({
    label,
    name: who?.nameEn ?? "",
    designation: designationOf(who?.nameEn),
    wing: wingOf(who?.nameEn),
    office: officeName,
    at: day(at),
  });

  const year = (order.reportedAt ?? new Date()).getFullYear();
  // The wing that produced the report. Where the order's tests are of both
  // disciplines — head office's are — the signatory's own wing answers, which
  // is what the masthead is actually claiming.
  const signatoryWing = desks.find(
    (d) => d.nameEn === (r?.authorisedBy?.nameEn ?? r?.testedBy?.nameEn),
  )?.wing;
  const discipline = disciplineOfOrder(order) ?? signatoryWing ?? null;

  return (
    <ReportDocument
      pdfHref={`/api/labs/reports/${orderId}/pdf`}
      backHref={`/workflow/work-order/${orderId}`}
      report={{
        orderCode: order.code,
        state: order.state,
        isDraft: !r?.approvedAt,
        reportNo: r?.reportNo ?? null,
        labRegNo: demoLabRegNo(discipline, order.code, year),
        labReferenceNo: demoLabReferenceNo(order.office.id, year),
        wingTitle: wingTitle(discipline),
        officeName,
        officeAddress: order.office?.addressEn ?? "",
        officePhone: order.office?.phone ?? null,
        packageName: order.subProduct.nameEn,
        productName: order.subProduct.product.nameEn,
        specification: order.subProduct.standardAsPrinted,
        receivedOn: day(order.receivedByWingAt),
        testingFrom: day(order.receivedByWingAt),
        testingTo: day(order.reportedAt ?? r?.testedAt ?? null),
        urgent: order.isUrgent,
        // Nothing records this yet, and the form always says the same thing
        // when a seal arrived intact — so it is stated rather than invented.
        condition:
          order.specimens.find((s) => s.conditionNote)?.conditionNote ??
          "The sample was received in good condition.",
        specimens: order.specimens.map((s) => ({
          labCode: s.labCode,
          specimenNo: s.specimenNo,
        })),
        referrals: [
          ...new Map(
            order.items
              .flatMap((i) => (i.referral?.referral ? [i.referral.referral] : []))
              .map((x) => [x.referralNo, x]),
          ).values(),
        ],
        rows,
        remark: conforms.text,
        remarks: r?.remarks ?? null,
        seals: [
          seal("Tested by", r?.testedBy, r?.testedAt ?? null),
          seal("Checked by", r?.checkedBy, r?.checkedAt ?? null),
          seal("Authorized Signatory", r?.authorisedBy, r?.authorisedAt ?? null),
        ],
      }}
    />
  );
}
