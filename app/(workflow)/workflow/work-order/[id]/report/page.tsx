import { notFound } from "next/navigation";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor } from "@/lib/workflow/inbox";
import { canViewOrder } from "@/lib/labs/board";
import { labActorFor } from "@/lib/labs/testing";
import { buildReportView } from "@/lib/labs/report-view";
import { declaredLimitsForOrder } from "@/lib/cm/declared-limits";
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
 *
 * **The document itself is assembled in `lib/labs/report-view.ts`**, because
 * the field officer reads the same paper against his application (D147) and two
 * assemblies would be two documents free to drift. The declared limits are
 * fetched here and passed in: crossing to an application is the CM side's to
 * do (D144), so the builder stays blind.
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

  const report = await buildReportView(orderId, await declaredLimitsForOrder(orderId));
  if (!report) notFound();

  return (
    <ReportDocument
      report={report}
      pdfHref={`/api/labs/reports/${orderId}/pdf`}
      backHref={`/workflow/work-order/${orderId}`}
    />
  );
}
