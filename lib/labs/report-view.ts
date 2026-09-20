/**
 * The test report as one assembled view (D145), built once and read from both
 * sides of the sample cut.
 *
 * **Why it is a module and not two pages.** The laboratory reads this document
 * on its work order and the field officer reads it against his application
 * (D147). Same paper, same figures, same seals — two copies of the assembly
 * would be two documents free to drift, and the one thing a test report must
 * not do is say different things to the bench and to the file.
 *
 * **It stays blind** (D71). Everything here is built from the order, which
 * carries no application column (D70). The declared limits are the one fact
 * that comes from the applicant, and they are **passed in** rather than
 * fetched: `declaredLimitsForOrder()` lives on the CM side because reaching
 * them means crossing (D144), so the caller does the crossing and hands in a
 * map of numbers. Nothing in this file can reach an application even by
 * accident, which is what makes it safe for the lab's own page to import.
 */
import { memoOfficeLabel } from "@/lib/bengali";
import { declaredKey, limitForReport } from "@/lib/labs/limits";
import {
  conformsLine,
  demoLabRegNo,
  demoLabReferenceNo,
  disciplineOfOrder,
  reportDocument,
  reportRows,
  wingTitle,
} from "@/lib/labs/report-document";
import { labDesksOfOffice } from "@/lib/labs/testing";

export type ReportView = {
  orderCode: string;
  state: string;
  isDraft: boolean;
  reportNo: string | null;
  labRegNo: string;
  labReferenceNo: string;
  wingTitle: string;
  officeName: string;
  officeAddress: string;
  officePhone: string | null;
  packageName: string;
  productName: string;
  specification: string | null;
  receivedOn: string | null;
  testingFrom: string | null;
  testingTo: string | null;
  urgent: boolean;
  condition: string;
  specimens: { labCode: string; specimenNo: number }[];
  referrals: { referralNo: string; labName: string }[];
  rows: {
    sl: number;
    description: string;
    standardLimit: string | null;
    isDeclared: boolean;
    result: string | null;
    verdict: string;
    method: string | null;
  }[];
  remark: string;
  remarks: string | null;
  seals: {
    label: string;
    name: string;
    designation: string | null;
    wing: string | null;
    office: string;
    at: string | null;
  }[];
};

const day = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : null;

/**
 * Assemble one order's report.
 *
 * Returns `null` where the order does not exist or names no office — the
 * masthead is the office's, so there is no document without one. Access is the
 * caller's question, deliberately: the lab asks `canViewOrder()`, the CM side
 * asks whether the order belongs to the file being read (D147).
 */
export async function buildReportView(
  orderId: number,
  declared: Map<string, string>,
): Promise<ReportView | null> {
  const order = await reportDocument(orderId);
  if (!order?.office) return null;

  const rows = reportRows(order.items, declared, limitForReport, declaredKey);
  const conforms = conformsLine(rows);

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
  const officeName = order.office.nameEn;
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

  return {
    orderCode: order.code,
    state: order.state,
    isDraft: !r?.approvedAt,
    reportNo: r?.reportNo ?? null,
    labRegNo: demoLabRegNo(discipline, order.code, year),
    labReferenceNo: demoLabReferenceNo(order.office.id, year),
    wingTitle: wingTitle(discipline),
    officeName,
    officeAddress: order.office.addressEn ?? "",
    officePhone: order.office.phone ?? null,
    packageName: order.subProduct.nameEn,
    productName: order.subProduct.product.nameEn,
    specification: order.subProduct.standardAsPrinted,
    receivedOn: day(order.receivedByWingAt),
    testingFrom: day(order.receivedByWingAt),
    testingTo: day(order.reportedAt ?? r?.testedAt ?? null),
    urgent: order.isUrgent,
    // Nothing records this yet, and the form always says the same thing when a
    // seal arrived intact — so it is stated rather than invented.
    condition:
      order.specimens.find((s) => s.conditionNote)?.conditionNote ??
      "The sample was received in good condition.",
    specimens: order.specimens.map((s) => ({ labCode: s.labCode, specimenNo: s.specimenNo })),
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
  };
}

export { memoOfficeLabel };
