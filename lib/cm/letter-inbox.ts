/**
 * The letters BSTI's own staff receive, read from the letter rather than from
 * the file (D130).
 *
 * **Standing on a file is the wrong question here.** `canViewApplication()`
 * grants a reader the file they hold, handled, or head the office of (D80) —
 * and the officer a sampling letter is addressed to is none of those. A
 * Faridpur inspection sends a box to Khulna, so Khulna's officer is asked to
 * expect samples on a file that will never touch their desk. Asked through the
 * application, every one of them is refused; the letters existed as rows with
 * no reader.
 *
 * So access is decided by the letter:
 *
 * - a **wing-head** letter belongs to the officer named on it, and to nobody
 *   else — `addressedToEmployeeId` is a person, set at issue;
 * - a **One Stop** letter belongs to whoever holds `one_stop` at the office it
 *   names, because a counter is a desk and not a person (D93);
 * - anyone with standing on the file may read either, which is how the officer
 *   who issued them can see what he sent.
 *
 * An **applicant** letter is not in here at all. It lives on the client
 * surface (D98), and the applicant is the one person who could not open it
 * under `/workflow`.
 *
 * Server half (D9).
 */
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/roles";
import { canViewApplication, type WorkflowActor } from "@/lib/workflow/inbox";
import { sampleSubmissionDueOn } from "./policy";

/** One line on the inbox. */
export type LetterInboxRow = {
  id: number;
  kind: "wing_head" | "one_stop";
  letterNo: string;
  issuedAt: Date;
  officeName: string;
  /** What is coming, and whether it has arrived. */
  boxCode: string | null;
  sealNo: string | null;
  submittedAt: Date | null;
  specimenCount: number;
  /** The box cannot be received until this is settled (D129). */
  feePaid: boolean;
  feePoisha: number | null;
};

/**
 * Everything addressed to this person, newest first.
 *
 * Two queries rather than one `OR`, because the two kinds are addressed by
 * different things — a person and a desk — and collapsing them into one filter
 * is what makes it easy to widen the wrong one later.
 */
export async function lettersForViewer(actor: WorkflowActor): Promise<LetterInboxRow[]> {
  const where: object[] = [];
  if (actor.employeeId) where.push({ kind: "wing_head" as const, addressedToEmployeeId: actor.employeeId });
  if (hasRole(actor, "one_stop") && actor.officeId)
    where.push({ kind: "one_stop" as const, officeId: actor.officeId });
  if (where.length === 0) return [];

  const rows = await prisma.sampleLetter.findMany({
    where: { OR: where },
    orderBy: { id: "desc" },
    select: {
      id: true,
      kind: true,
      letterNo: true,
      issuedAt: true,
      officeId: true,
      office: { select: { nameEn: true } },
      applicationId: true,
      application: {
        select: {
          testFeePoisha: true,
          testFeePayment: { select: { status: true } },
        },
      },
    },
  });

  // The box each letter is about — one per (application, office), which is what
  // the unique on `Consignment` guarantees.
  const boxes = await prisma.consignment.findMany({
    where: {
      applicationId: { in: [...new Set(rows.map((r) => r.applicationId))] },
    },
    select: {
      applicationId: true,
      officeId: true,
      code: true,
      sealNo: true,
      submittedAt: true,
      _count: { select: { registry: true } },
    },
  });
  const boxFor = new Map(boxes.map((b) => [`${b.applicationId}:${b.officeId}`, b]));

  return rows.map((r) => {
    const box = boxFor.get(`${r.applicationId}:${r.officeId}`);
    return {
      id: r.id,
      kind: r.kind as "wing_head" | "one_stop",
      letterNo: r.letterNo,
      issuedAt: r.issuedAt,
      officeName: r.office?.nameEn ?? "—",
      boxCode: box?.code ?? null,
      sealNo: box?.sealNo ?? null,
      submittedAt: box?.submittedAt ?? null,
      specimenCount: box?._count.registry ?? 0,
      feePaid: r.application.testFeePayment?.status === "paid",
      feePoisha: r.application.testFeePoisha,
    };
  });
}

/**
 * How many letters this desk has — for the navbar, which must not offer a
 * screen that answers `notFound()`.
 *
 * A count rather than `lettersForViewer().length`: the board renders on every
 * file view and the boxes behind those rows are not wanted there.
 */
export async function letterCountForViewer(actor: WorkflowActor): Promise<number> {
  const where: object[] = [];
  if (actor.employeeId) where.push({ kind: "wing_head" as const, addressedToEmployeeId: actor.employeeId });
  if (hasRole(actor, "one_stop") && actor.officeId)
    where.push({ kind: "one_stop" as const, officeId: actor.officeId });
  if (where.length === 0) return 0;
  return prisma.sampleLetter.count({ where: { OR: where } });
}

/** What one letter says. Two shapes, because the two ask different things. */
export type InternalLetter = {
  id: number;
  kind: "wing_head" | "one_stop";
  letterNo: string;
  issuedAt: Date;
  dueOn: Date;
  issuedBy: { name: string; designation: string | null };
  /** Whose letterhead the paper carries — the office that ran the inspection. */
  issuingOffice: { nameBn: string; addressBn: string; email: string | null } | null;
  /** Addressed to a person for a wing head, to a desk for a counter. */
  addressedTo: { name: string; designation: string | null } | null;
  officeName: string;
  officeNameBn: string;
  box: {
    code: string;
    sealNo: string;
    submittedAt: Date | null;
    specimenCount: number;
  } | null;
  /** What is in the box, test-side: the package and how many tests it carries. */
  packages: { name: string; parameterCount: number; specimenCount: number }[];
  feePoisha: number | null;
  feePaid: boolean;
  /**
   * The applicant — **only ever populated for a One Stop letter**. The counter
   * hands the box back and forth with the person carrying it and checks the
   * fee against their file, so it has to name them. A wing head is testing-wing
   * staff, and the variant *is* the applicant's identity (D71): the company,
   * the factory and the brand are absent from that letter by design, not by
   * omission.
   */
  applicant: { applicationNo: string | null; company: string; product: string | null } | null;
};

export async function internalLetterFor(
  letterId: number,
  actor: WorkflowActor,
): Promise<InternalLetter | null> {
  const l = await prisma.sampleLetter.findUnique({
    where: { id: letterId },
    select: {
      id: true,
      kind: true,
      letterNo: true,
      issuedAt: true,
      officeId: true,
      applicationId: true,
      addressedToEmployeeId: true,
      addressedTo: { select: { nameEn: true, designationBn: true, designationEn: true } },
      office: { select: { nameEn: true, nameBn: true } },
      issuedBy: { select: { nameEn: true, designationBn: true, designationEn: true } },
      application: {
        select: {
          applicationNo: true,
          testFeePoisha: true,
          testFeePayment: { select: { status: true } },
          product: { select: { nameEn: true, nameBn: true } },
          organization: { select: { nameEn: true, nameBn: true } },
          bstiOffice: { select: { nameBn: true, addressBn: true, email: true } },
        },
      },
    },
  });
  if (!l) return null;
  if (l.kind !== "wing_head" && l.kind !== "one_stop") return null;

  // Whether this person may read it — the letter decides, not the file.
  const allowed =
    hasRole(actor, "superadmin") ||
    (l.kind === "wing_head" && !!actor.employeeId && l.addressedToEmployeeId === actor.employeeId) ||
    (l.kind === "one_stop" && hasRole(actor, "one_stop") && l.officeId === actor.officeId) ||
    (await canViewApplication(actor, l.applicationId));
  if (!allowed) return null;

  const box = l.officeId
    ? await prisma.consignment.findFirst({
        where: { applicationId: l.applicationId, officeId: l.officeId },
        select: {
          code: true,
          sealNo: true,
          submittedAt: true,
          registry: {
            select: {
              applicationSubProduct: {
                select: {
                  subProduct: {
                    select: { nameEn: true, nameBn: true, _count: { select: { parameters: true } } },
                  },
                },
              },
            },
          },
        },
      })
    : null;

  // One row per package in the box, with how many jars and how many tests.
  const packages = new Map<string, { name: string; parameterCount: number; specimenCount: number }>();
  for (const r of box?.registry ?? []) {
    const sp = r.applicationSubProduct.subProduct;
    const name = sp.nameBn ?? sp.nameEn;
    const cur = packages.get(name);
    if (cur) cur.specimenCount++;
    else packages.set(name, { name, parameterCount: sp._count.parameters, specimenCount: 1 });
  }

  return {
    id: l.id,
    kind: l.kind,
    letterNo: l.letterNo,
    issuedAt: l.issuedAt,
    dueOn: sampleSubmissionDueOn(l.issuedAt),
    issuedBy: {
      name: l.issuedBy.nameEn,
      designation: l.issuedBy.designationBn ?? l.issuedBy.designationEn ?? null,
    },
    issuingOffice: l.application.bstiOffice
      ? {
          nameBn: l.application.bstiOffice.nameBn,
          addressBn: l.application.bstiOffice.addressBn ?? "",
          email: l.application.bstiOffice.email,
        }
      : null,
    addressedTo: l.addressedTo
      ? {
          name: l.addressedTo.nameEn,
          designation: l.addressedTo.designationBn ?? l.addressedTo.designationEn ?? null,
        }
      : null,
    officeName: l.office?.nameEn ?? "—",
    officeNameBn: l.office?.nameBn ?? l.office?.nameEn ?? "—",
    box: box
      ? {
          code: box.code,
          sealNo: box.sealNo,
          submittedAt: box.submittedAt,
          specimenCount: box.registry.length,
        }
      : null,
    packages: [...packages.values()],
    feePoisha: l.application.testFeePoisha,
    feePaid: l.application.testFeePayment?.status === "paid",
    applicant:
      l.kind === "one_stop"
        ? {
            applicationNo: l.application.applicationNo,
            company: l.application.organization.nameBn ?? l.application.organization.nameEn,
            product: l.application.product?.nameBn ?? l.application.product?.nameEn ?? null,
          }
        : null,
  };
}
