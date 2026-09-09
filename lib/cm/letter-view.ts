/**
 * The applicant's sample submission letter, assembled for the page that prints
 * it and for the panel that announces it (D98).
 *
 * **This is the only letter of the three the applicant ever sees**, and it is
 * the one that asks something of them: carry these sealed boxes to these
 * counters, seals intact. So it is built from the consignments themselves —
 * every box, its seal number, and the office whose One Stop counter receives
 * it — rather than from anything typed, for the same reason destinations are
 * derived and not entered (D69). A box left off this letter is a box the
 * applicant is never told to carry, and it surfaces at a laboratory days later
 * in another city (D72).
 *
 * **The destination office is the laboratory's, not the file's.** The
 * application belongs to one office; the samples go wherever the testing lab
 * is, which is often somewhere else entirely.
 *
 * Server half (D9).
 */
import { prisma } from "@/lib/prisma";
import { sampleSubmissionDueOn } from "./policy";

export type SubmissionBox = {
  code: string;
  sealNo: string;
  labName: string;
  discipline: string;
  /** Where the applicant carries it — the laboratory's own office. */
  officeName: string;
  officeAddress: string | null;
  specimenCount: number;
  /** Handed in already? Then this row is a receipt, not an instruction. */
  submittedAt: Date | null;
};

export type ApplicantLetter = {
  letterNo: string;
  issuedAt: Date;
  dueOn: Date;
  issuedBy: { name: string; designation: string | null };
  /** The office that issued it — whose letterhead the paper carries. */
  issuingOffice: { nameBn: string; addressBn: string; email: string | null } | null;
  applicationNo: string | null;
  product: string | null;
  company: string;
  companyAddress: string | null;
  factory: string;
  factoryAddress: string | null;
  inspectedOn: Date | null;
  reportNo: string | null;
  boxes: SubmissionBox[];
};

/**
 * Null until the officer issues the letters — a planned letter is not a letter,
 * and showing the applicant a draft of an instruction nobody has signed would
 * have them carrying jars on the strength of it.
 */
export async function applicantLetterFor(applicationId: number): Promise<ApplicantLetter | null> {
  const letter = await prisma.sampleLetter.findFirst({
    where: { applicationId, kind: "applicant" },
    select: {
      letterNo: true,
      issuedAt: true,
      issuedBy: {
        select: { nameEn: true, designationBn: true, designationEn: true },
      },
    },
  });
  if (!letter) return null;

  const [app, consignments, plan, report] = await Promise.all([
    prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        applicationNo: true,
        product: { select: { nameEn: true, nameBn: true } },
        organization: {
          select: { nameEn: true, nameBn: true, addressLine: true, district: true },
        },
        factory: { select: { nameEn: true, nameBn: true, addressLine: true, district: true } },
        bstiOffice: { select: { nameBn: true, addressBn: true, email: true } },
      },
    }),
    prisma.consignment.findMany({
      where: { applicationId },
      select: {
        code: true,
        sealNo: true,
        submittedAt: true,
        office: { select: { nameEn: true, nameBn: true, addressBn: true } },
        _count: { select: { registry: true } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.inspectionPlan.findUnique({
      where: { applicationId },
      select: { scheduledOn: true },
    }),
    prisma.inspectionReport.findUnique({
      where: { applicationId },
      select: { reportNo: true },
    }),
  ]);
  if (!app) return null;

  const join = (...parts: (string | null | undefined)[]) =>
    parts.map((p) => p?.trim()).filter(Boolean).join(", ") || null;

  return {
    letterNo: letter.letterNo,
    issuedAt: letter.issuedAt,
    dueOn: sampleSubmissionDueOn(letter.issuedAt),
    issuedBy: {
      name: letter.issuedBy.nameEn,
      designation: letter.issuedBy.designationBn ?? letter.issuedBy.designationEn ?? null,
    },
    issuingOffice: app.bstiOffice
      ? {
          nameBn: app.bstiOffice.nameBn,
          addressBn: app.bstiOffice.addressBn ?? "",
          email: app.bstiOffice.email,
        }
      : null,
    applicationNo: app.applicationNo,
    product: app.product?.nameBn ?? app.product?.nameEn ?? null,
    company: app.organization.nameBn ?? app.organization.nameEn,
    companyAddress: join(app.organization.addressLine, app.organization.district),
    factory: app.factory.nameBn ?? app.factory.nameEn,
    factoryAddress: join(app.factory.addressLine, app.factory.district),
    inspectedOn: plan?.scheduledOn ?? null,
    reportNo: report?.reportNo ?? null,
    boxes: consignments.map((c) => ({
      code: c.code,
      sealNo: c.sealNo,
      // The destination is an office. It may run the tests on its own bench or
      // send them out; either way that is where the box is carried (D116).
      labName: c.office?.nameEn ?? "—",
      discipline: "",
      officeName: c.office?.nameBn ?? c.office?.nameEn ?? "—",
      officeAddress: c.office?.addressBn ?? null,
      specimenCount: c._count.registry,
      submittedAt: c.submittedAt,
    })),
  };
}
