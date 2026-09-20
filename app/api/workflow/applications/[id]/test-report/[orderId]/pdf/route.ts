import { NextResponse } from "next/server";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor, canViewApplication } from "@/lib/workflow/inbox";
import { applicationIdForOrder } from "@/lib/cm/lab-progress";
import { reportIsReadableByFile } from "@/lib/cm/test-reports";
import { prisma } from "@/lib/prisma";
import { pdfFromPage } from "@/lib/pdf-page";

/**
 * An approved test report as a PDF, from the file's side (D147).
 *
 * The laboratory's own download is `/api/labs/reports/[id]/pdf` and it is
 * guarded by standing on the bench, which the field officer has not got. This
 * renders the CM-side page instead and asks the CM-side questions — standing on
 * the file, the order belonging to it, the report being approved — so neither
 * route can be used to reach the other's documents.
 *
 * Access is re-checked before Chromium starts: the page would refuse too, but
 * launching a browser for a request that is going to 404 is a needless way to
 * spend a second.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> },
) {
  const { id, orderId: orderParam } = await params;
  const applicationId = Number(id);
  const orderId = Number(orderParam);
  if (!Number.isInteger(applicationId) || !Number.isInteger(orderId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const viewer = await requireInternal();
  const actor = await actorFor(viewer);
  if (!(await canViewApplication(actor, applicationId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if ((await applicationIdForOrder(orderId)) !== applicationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await reportIsReadableByFile(orderId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const report = await prisma.labTestReport.findUnique({
    where: { orderId },
    select: { reportNo: true },
  });

  return pdfFromPage(req, {
    path: `/workflow/cm/${applicationId}/test-report/${orderId}`,
    filename: `test-report-${(report?.reportNo ?? String(orderId)).replace(/[^A-Za-z0-9._-]+/g, "-")}.pdf`,
  });
}
