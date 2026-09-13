import { notFound } from "next/navigation";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor } from "@/lib/workflow/inbox";
import { internalLetterFor } from "@/lib/cm/letter-inbox";
import { orgForOffice } from "@/lib/db";
import { toBengaliDigits } from "@/lib/bengali";
import InternalLetterDocument from "./InternalLetterDocument";

export const dynamic = "force-dynamic";

export const metadata = { title: "নমুনা পত্র — BSTI e-Services" };

/**
 * One letter, read by the desk it was addressed to (D130).
 *
 * Access is the letter's, not the file's — see `lib/cm/letter-inbox.ts`. A
 * refusal is `notFound()` rather than a 403, for the reason D71 gives: a
 * distinguishable refusal would let any member of staff enumerate which letters
 * exist and which office they went to.
 */
export default async function InternalLetterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const letterId = Number(id);
  if (!Number.isInteger(letterId)) notFound();

  const viewer = await requireInternal(`/workflow/letters/${id}`);
  const actor = await actorFor(viewer);
  const letter = await internalLetterFor(letterId, actor);
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
    <InternalLetterDocument
      org={org}
      backHref="/workflow/letters"
      pdfHref={`/api/workflow/letters/${letter.id}/pdf`}
      letter={{
        kind: letter.kind,
        letterNo: toBengaliDigits(letter.letterNo),
        issuedOn: bnDate(letter.issuedAt),
        dueOn: bnDate(letter.dueOn),
        issuedBy: letter.issuedBy,
        addressedTo: letter.addressedTo,
        officeNameBn: letter.officeNameBn,
        box: letter.box
          ? {
              code: letter.box.code,
              sealNo: letter.box.sealNo,
              submitted: letter.box.submittedAt !== null,
              specimenCount: letter.box.specimenCount,
            }
          : null,
        packages: letter.packages,
        feeTaka:
          letter.feePoisha !== null
            ? `${toBengaliDigits((letter.feePoisha / 100).toLocaleString("en-BD"))}/- টাকা`
            : null,
        feePaid: letter.feePaid,
        applicant: letter.applicant,
      }}
    />
  );
}
