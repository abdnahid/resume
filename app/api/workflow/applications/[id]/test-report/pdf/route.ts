import { NextResponse } from "next/server";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor, canViewApplication } from "@/lib/workflow/inbox";
import { labProgressFor } from "@/lib/cm/lab-progress";
import { prisma } from "@/lib/prisma";
import { pdfFromPage } from "@/lib/pdf-page";

/** The consolidated test report as a PDF (A§8, D147). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const applicationId = Number(id);
  if (!Number.isInteger(applicationId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const viewer = await requireInternal();
  const actor = await actorFor(viewer);
  if (!(await canViewApplication(actor, applicationId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // The same gate the page applies, asked before Chromium starts. Cheaper than
  // compiling the whole document twice.
  if (!(await labProgressFor(applicationId)).complete) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { applicationNo: true },
  });
  const safe = (app?.applicationNo ?? String(applicationId)).replace(/[^A-Za-z0-9._-]+/g, "-");

  return pdfFromPage(req, {
    path: `/workflow/cm/${applicationId}/test-report`,
    filename: `consolidated-test-report-${safe}.pdf`,
  });
}
