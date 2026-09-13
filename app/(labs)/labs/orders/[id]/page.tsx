import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ModuleNavbar from "@/components/layout/ModuleNavbar";
import PageContainer from "@/components/PageContainer";
import { prisma } from "@/lib/prisma";
import { requireInternal } from "@/lib/auth-guard";
import { LABS_NAV } from "../../_components/nav";
import { actionsFor, canViewOrder, orderDetail } from "@/lib/labs/board";
import { type LabActor, passCandidates, planForOffice, resultLines } from "@/lib/labs/testing";
import { reportFor } from "@/lib/labs/report";
import { RUNG_LABELS, describeLabMovement, overallVerdict } from "@/lib/labs/ladder";
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
  const viewer = await requireInternal("/labs/orders");
  const orderId = Number((await params).id);
  if (!Number.isInteger(orderId)) notFound();

  const me = viewer.employeeId
    ? await prisma.employee.findUnique({
        where: { id: viewer.employeeId },
        select: { officeId: true },
      })
    : null;
  const actor: LabActor = {
    employeeId: viewer.employeeId ?? "",
    userId: viewer.id,
    officeId: me?.officeId ?? null,
    roles: viewer.roles,
    role: viewer.role,
  };

  if (!(await canViewOrder(actor, orderId))) notFound();

  const order = await orderDetail(orderId);
  if (!order || !order.officeId) notFound();

  const [actions, results, report, candidates, plan] = await Promise.all([
    actionsFor(actor, orderId),
    resultLines(orderId),
    reportFor(orderId),
    passCandidates(orderId),
    planForOffice(order.officeId),
  ]);

  const gaps = results
    ? overallVerdict(
        results.lines.flatMap((l) =>
          l.bySample.map((s) => ({
            label: l.bySample.length > 1 ? `${l.label} (specimen ${s.specimenNo})` : l.label,
            verdict: s.verdict,
          })),
        ),
      ).gaps
    : [];

  return (
    <>
      <ModuleNavbar moduleName="Laboratory" moduleSubtitle="BSTI e-Services" navItems={LABS_NAV} />
      <PageContainer>
        <Link
          href="/labs/orders"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
        >
          <ArrowLeft size={14} /> Test orders
        </Link>

        <OrderWorkspace
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
