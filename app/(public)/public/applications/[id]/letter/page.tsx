import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth-guard";
import { membershipFor } from "@/lib/cm/applications";
import { applicantLetterFor } from "@/lib/cm/letter-view";
import { orgForOffice } from "@/lib/db";
import { toBengaliDigits } from "@/lib/bengali";
import LetterDocument from "./LetterDocument";

export const dynamic = "force-dynamic";

export const metadata = { title: "নমুনা জমাদান পত্র — BSTI e-Services" };

/**
 * The applicant's sample submission letter (D98).
 *
 * Membership is the access check, exactly as on the application page it hangs
 * off: a wrong id is a 404 rather than a 403, so someone else's letter — which
 * carries their seal numbers — is not confirmed to exist.
 */
export default async function LetterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ office?: string }>;
}) {
  const { id } = await params;
  const applicationId = Number(id);
  if (!Number.isInteger(applicationId)) notFound();

  // Which destination's letter (D128). Omitted, the earliest is shown — which
  // is what an older link means and what a single-box file needs.
  const office = Number((await searchParams).office);
  const officeParam = Number.isInteger(office) ? office : undefined;

  const viewer = await requireClient(`/public/applications/${id}/letter`);
  const membership = await membershipFor(viewer.id, applicationId);
  if (!membership) notFound();

  const letter = await applicantLetterFor(applicationId, officeParam);
  if (!letter) notFound();

  const org = orgForOffice({
    nameBn: letter.issuingOffice?.nameBn ?? "প্রধান কার্যালয়, বিএসটিআই, ঢাকা",
    addressBn: letter.issuingOffice?.addressBn ?? "",
    email: letter.issuingOffice?.email ?? null,
  });

  const bnDate = (d: Date) =>
    toBengaliDigits(
      d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }),
    );

  return (
    <LetterDocument
      org={org}
      backHref={`/public/applications/${applicationId}`}
      pdfHref={`/api/client/applications/${applicationId}/letter/pdf${officeParam ? `?office=${officeParam}` : ""}`}
      letter={{
        letterNo: toBengaliDigits(letter.letterNo),
        issuedOn: bnDate(letter.issuedAt),
        dueOn: bnDate(letter.dueOn),
        issuedBy: letter.issuedBy,
        applicationNo: letter.applicationNo,
        product: letter.product,
        company: letter.company,
        companyAddress: letter.companyAddress,
        factory: letter.factory,
        factoryAddress: letter.factoryAddress,
        inspectedOn: letter.inspectedOn ? bnDate(letter.inspectedOn) : null,
        reportNo: letter.reportNo ? toBengaliDigits(letter.reportNo) : null,
        boxes: letter.boxes.map((b) => ({
          code: b.code,
          sealNo: b.sealNo,
          labName: b.labName,
          discipline: b.discipline,
          officeName: b.officeName,
          officeAddress: b.officeAddress,
          specimenCount: b.specimenCount,
          submitted: b.submittedAt !== null,
        })),
      }}
    />
  );
}
