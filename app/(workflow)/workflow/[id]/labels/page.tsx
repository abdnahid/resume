import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor, canViewApplication } from "@/lib/workflow/inbox";
import { getApplication } from "@/lib/cm/applications";
import { samplingView } from "@/lib/samples/screen";
import { planFor } from "@/lib/cm/inspection";
import { reportFor, inspectionAudience } from "@/lib/cm/inspection-report";
import LabelSheet from "./LabelSheet";

export const dynamic = "force-dynamic";

/**
 * The tokens the FDO carries to the factory (D87).
 *
 * **Only `ref` is printed.** A QR is an encoded string and any phone decodes it
 * without a session, so whatever is on the jar is readable by the FDO who binds
 * it *and* by the examiner who opens the box. Printing either side's working
 * code would hand it to the other, which is the whole reason there are three
 * identifiers (D68). `cmCode` and `labCode` are not fetched here at all.
 *
 * The QR is rendered to SVG **on the server**, so nothing is added to the
 * client bundle and the same markup prints, screens and goes into a PDF.
 */
export default async function LabelsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const applicationId = Number(id);
  if (!Number.isInteger(applicationId)) notFound();

  const viewer = await requireInternal(`/workflow/${id}/labels`);
  const actor = await actorFor(viewer);
  if (!(await canViewApplication(actor, applicationId))) notFound();

  const [app, view] = await Promise.all([getApplication(applicationId), samplingView(applicationId)]);
  if (!app || !view.committed) notFound();

  // Labels belong to the visit, so they follow the report's audience (D90) —
  // a senior who cannot read the report has no use for the jar codes either.
  const [plan, report] = await Promise.all([planFor(applicationId), reportFor(applicationId)]);
  const audience = inspectionAudience({
    visitingOfficerId: plan?.proposedByEmployeeId ?? null,
    holderEmployeeId: app.holderEmployeeId,
    viewerEmployeeId: actor.employeeId,
    viewerRole: actor.role,
    submittedAt: report?.submittedAt ?? null,
    approvedAt: report?.approvedAt ?? null,
  });
  if (audience === "none") notFound();

  // `/s/<ref>` is what the label resolves to — it answers by role and
  // relationship, and refuses identically to everyone else (D71).
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const labels = await Promise.all(
    view.committed.consignments.flatMap((c) =>
      c.specimens.map(async (s) => ({
        ...s,
        boxCode: c.code,
        labName: c.labName,
        qr: await QRCode.toString(`${origin}/s/${s.ref}`, {
          type: "svg",
          margin: 0,
          errorCorrectionLevel: "M",
        }),
      })),
    ),
  );

  return (
    <LabelSheet
      applicationNo={app.applicationNo}
      productName={app.product?.nameEn ?? null}
      labels={labels}
    />
  );
}
