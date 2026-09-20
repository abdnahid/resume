import { notFound } from "next/navigation";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor, canViewApplication } from "@/lib/workflow/inbox";
import { consolidatedReportFor } from "@/lib/cm/consolidated-report";
import { orgForOffice } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import ConsolidatedReportDocument from "./ConsolidatedReportDocument";

export const dynamic = "force-dynamic";

/**
 * The consolidated test report (A§8, D147).
 *
 * **It exists only when every report is in.** `consolidatedReportFor()`
 * returns null otherwise, and that is a `notFound()` rather than a page saying
 * "not ready": a conformity determination over a partial set of results is the
 * one thing this document must never be, and a half-compiled version would be
 * quoted the moment it could be printed. The panel on the process page says
 * what is still outstanding, which is where that belongs.
 *
 * **Standing is the file's** (D80), not the bench's — this is the officer's
 * document about his own application, and the letterhead is his office's.
 */
export default async function ConsolidatedReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const applicationId = Number(id);
  if (!Number.isInteger(applicationId)) notFound();

  const viewer = await requireInternal(`/workflow/cm/${id}/test-report`);
  const actor = await actorFor(viewer);
  if (!(await canViewApplication(actor, applicationId))) notFound();

  const report = await consolidatedReportFor(applicationId);
  if (!report) notFound();

  // The letterhead is the office the file belongs to, as on the office order —
  // a report compiled at Faridpur carrying the Dhaka address would be wrong on
  // its face.
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { bstiOfficeId: true },
  });
  const office = app?.bstiOfficeId
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

  return (
    <ConsolidatedReportDocument
      org={org}
      report={report}
      pdfHref={`/api/workflow/applications/${applicationId}/test-report/pdf`}
      backHref={`/workflow/cm/${applicationId}/process`}
    />
  );
}
