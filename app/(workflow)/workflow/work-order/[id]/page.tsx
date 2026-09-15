import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ModuleNavbar from "@/components/layout/ModuleNavbar";
import PageContainer from "@/components/PageContainer";
import { requireInternal } from "@/lib/auth-guard";
import { workflowNav } from "@/lib/workflow/nav";
import { actorFor } from "@/lib/workflow/inbox";
import { lettersForWorkOrders } from "@/lib/cm/letter-inbox";
import { formatPoisha } from "@/lib/payments/money";
import { hasAnyRole } from "@/lib/roles";
import { actionsFor, canViewOrder, orderDetail } from "@/lib/labs/board";
import {
  labActorFor,
  passCandidates,
  planForOffice,
  reportGaps,
  resultLines,
} from "@/lib/labs/testing";
import { reportFor } from "@/lib/labs/report";
import { referrableItems, referralsFor } from "@/lib/labs/referral";
import { RUNG_LABELS, describeLabMovement } from "@/lib/labs/ladder";
import OrderWorkspace from "./OrderWorkspace";

export const dynamic = "force-dynamic";

/**
 * One test order — the bench, and the report that comes off it (D133).
 *
 * **Blind, and it has to stay that way.** The package, the specimens by their
 * `labCode`, the parameters and their limits. No company, no factory, no brand,
 * no application number: the variant *is* the applicant's identity (D71) and
 * these are exactly the people it is kept from. A refusal is `notFound()`, so
 * nobody can enumerate which orders exist by probing ids.
 */
export default async function LabOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireInternal("/workflow/work-order");
  const orderId = Number((await params).id);
  if (!Number.isInteger(orderId)) notFound();

  // `actorFor()` rather than a bare `Employee.officeId` read: every other
  // `/workflow` screen resolves the office from the current posting, and a
  // board sitting in the module that resolved it differently is drift waiting
  // for somebody's transfer.
  const wfActor = await actorFor(viewer);
  const actor = labActorFor(wfActor);

  if (!(await canViewOrder(actor, orderId))) notFound();

  const order = await orderDetail(orderId);
  if (!order || !order.officeId) notFound();

  const [actions, results, report, candidates, plan, letters, referrable, referrals] =
    await Promise.all([
      actionsFor(actor, orderId),
      resultLines(orderId),
      reportFor(orderId),
      passCandidates(orderId),
      planForOffice(order.officeId),
      lettersForWorkOrders([orderId], wfActor),
      referrableItems(orderId),
      referralsFor(orderId),
    ]);
  const letter = letters.get(orderId) ?? null;

  const navItems = workflowNav({
    counter: hasAnyRole(wfActor, "one_stop", "superadmin") && wfActor.officeId !== null,
    workOrders: true,
  });

  const day = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  // **The same list `submitReport()` refuses on**, asked of the service rather
  // than recomputed here. There were three copies of this rule — the screen,
  // the submit and `reportGaps()` — and the moment one of them learned about
  // outstanding referrals (D140) the other two would have disagreed with it.
  const gaps = await reportGaps(orderId);

  return (
    <>
      <ModuleNavbar
        moduleName="Workflow"
        moduleSubtitle="BSTI e-Services"
        navItems={navItems}
        activeHref="/workflow/work-order"
      />
      <PageContainer>
        <Link
          href="/workflow/work-order"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
        >
          <ArrowLeft size={14} /> Work orders
        </Link>

        <OrderWorkspace
          letter={
            letter && {
              id: letter.id,
              letterNo: letter.letterNo,
              issuedOn: day(letter.issuedAt),
              dueOn: day(letter.dueOn),
              issuedBy: letter.issuedBy,
              urgent: letter.urgent,
              feeTaka: letter.feePoisha !== null ? formatPoisha(letter.feePoisha) : null,
              feePaid: letter.feePaid,
              boxCode: letter.boxCode,
              sealNo: letter.sealNo,
              handedIn: letter.submittedAt !== null,
              specimenCount: letter.specimenCount,
              pdfHref: `/api/workflow/letters/${letter.id}/pdf`,
            }
          }
          order={{
            id: order.id,
            code: order.code,
            state: order.state,
            isUrgent: order.isUrgent,
            labName: order.lab?.nameEn ?? null,
            discipline: order.lab?.discipline ?? null,
            officeName: order.office?.nameEn ?? "",
            productName: order.subProduct.product.nameEn,
            subProductName: order.subProduct.nameEn,
            standard: order.subProduct.standardAsPrinted,
            receivedByWingAt: order.receivedByWingAt?.toISOString() ?? null,
            receivedByWingName: order.receivedByWing?.nameEn ?? null,
            holderName: order.holder?.nameEn ?? null,
            holderRung: order.holderRung,
          }}
          referrable={referrable.map((i) => ({
            orderItemId: i.orderItemId,
            nameEn: i.nameEn,
            discipline: i.discipline,
            declared: i.declared,
            referral: i.referral,
          }))}
          referrals={referrals.map((r) => ({
            id: r.id,
            referralNo: r.referralNo,
            labName: r.labName,
            labAddress: r.labAddress,
            issuedOn: day(r.issuedAt),
            resultsInOn: r.resultsInAt ? day(r.resultsInAt) : null,
            issuedByName: r.issuedBy.nameEn,
            note: r.note,
            tests: r.items.map((i) => i.orderItem.parameter.nameEn),
            resultCount: r._count.results,
            href: `/workflow/work-order/${order.id}/referral/${r.id}`,
            pdfHref: `/api/labs/referrals/${r.id}/pdf`,
          }))}
          specimens={order.specimens.map((s) => ({
            id: s.id,
            labCode: s.labCode,
            specimenNo: s.specimenNo,
            state: s.state,
          }))}
          lines={results?.lines ?? []}
          actions={actions}
          gaps={gaps}
          candidates={{
            rung: candidates.rung,
            rungLabel: candidates.rung ? RUNG_LABELS[candidates.rung] : null,
            desks: candidates.desks.map((d) => ({
              employeeId: d.employeeId,
              nameEn: d.nameEn,
              designation: d.designation,
              isTestingOfficer: d.isTestingOfficer,
            })),
          }}
          signaturePlan={{
            testedBy: RUNG_LABELS[plan.plan.testedBy],
            checkedBy: plan.plan.checkedBy ? RUNG_LABELS[plan.plan.checkedBy] : null,
            authorisedBy: RUNG_LABELS[plan.plan.authorisedBy],
          }}
          report={
            report && {
              reportNo: report.reportNo,
              verdict: report.verdict,
              remarks: report.remarks,
              returnedNote: report.returnedNote,
              testedBy: sig(report.testedBy, report.testedAt),
              checkedBy: sig(report.checkedBy, report.checkedAt),
              authorisedBy: sig(report.authorisedBy, report.authorisedAt),
              approvedBy: sig(report.approvedBy, report.approvedAt),
            }
          }
          flow={order.movements.map((m) => ({
            id: m.id,
            at: m.createdAt.toISOString(),
            text: describeLabMovement({
              direction: m.direction,
              fromName: m.fromEmployee?.nameEn ?? null,
              toName: m.toEmployee.nameEn,
              note: m.note,
            }),
          }))}
        />
      </PageContainer>
    </>
  );
}

function sig(
  p: { nameEn: string; nameBn: string; designationEn: string | null; designationBn: string | null } | null,
  at: Date | null,
) {
  if (!p) return null;
  return {
    nameEn: p.nameEn,
    nameBn: p.nameBn,
    designation: p.designationEn ?? p.designationBn,
    at: at?.toISOString() ?? null,
  };
}
