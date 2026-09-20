import { notFound } from "next/navigation";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor, canViewApplication } from "@/lib/workflow/inbox";
import { buildReportView } from "@/lib/labs/report-view";
import { declaredLimitsForOrder } from "@/lib/cm/declared-limits";
import { applicationIdForOrder } from "@/lib/cm/lab-progress";
import { reportIsReadableByFile } from "@/lib/cm/test-reports";
import ReportDocument from "../../../../work-order/[id]/report/ReportDocument";

export const dynamic = "force-dynamic";

/**
 * An approved test report, read from the file it belongs to (D147).
 *
 * **Why the CM side needs its own route.** The document lives at
 * `/workflow/work-order/[id]/report` behind `canViewOrder()` — standing on the
 * *bench* — and the field officer has none: he is not on the laboratory ladder
 * and never will be. So the one person accountable for the file could not read
 * the report about his own sample. Widening `canViewOrder()` was the wrong fix
 * in the obvious direction: it would put an application join inside
 * `lib/labs/`, which is blind by construction (D71) and must stay that way.
 *
 * **Two questions, both asked here.** Standing on the *file* is
 * `canViewApplication()` (D80) — you hold it, handled it, head its office, or
 * are a superadmin. Then the order must actually belong to this application,
 * through `applicationIdForOrder()`, the named crossing (D133). Without the
 * second check the route would be an oracle: any order id under a file you can
 * read would render, so one application's officer could walk the whole
 * database's reports.
 *
 * **Only an approved report** — `reportIsReadableByFile()`. A draft belongs to
 * the wing while it is being written, exactly as an unsent inspection report
 * belongs to the visiting officer (D90); the FDO reads the signed document, not
 * the working one. A refusal is `notFound()` either way (D71), so the route
 * never tells him a report exists but is not his yet.
 */
export default async function FileTestReportPage({
  params,
}: {
  params: Promise<{ id: string; orderId: string }>;
}) {
  const { id, orderId: orderParam } = await params;
  const applicationId = Number(id);
  const orderId = Number(orderParam);
  if (!Number.isInteger(applicationId) || !Number.isInteger(orderId)) notFound();

  const viewer = await requireInternal(`/workflow/cm/${id}/test-report/${orderParam}`);
  const actor = await actorFor(viewer);
  if (!(await canViewApplication(actor, applicationId))) notFound();

  // The order has to be one of this file's, and reportable.
  if ((await applicationIdForOrder(orderId)) !== applicationId) notFound();
  if (!(await reportIsReadableByFile(orderId))) notFound();

  const report = await buildReportView(orderId, await declaredLimitsForOrder(orderId));
  if (!report) notFound();

  return (
    <ReportDocument
      report={report}
      pdfHref={`/api/workflow/applications/${applicationId}/test-report/${orderId}/pdf`}
      backHref={`/workflow/cm/${applicationId}/process`}
    />
  );
}
