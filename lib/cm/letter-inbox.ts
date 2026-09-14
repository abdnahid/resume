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
  /** Urgent testing, decided when the letters went out (D134). */
  urgent: boolean;
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
          isUrgent: true,
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
      urgent: r.application.isUrgent,
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
  /**
   * What is in the box, test-side: each package, its jars, and **the tests
   * this office is being asked to run** (D134).
   *
   * Named, not counted. A count told the wing head how much work was coming
   * and not what the work was, so the one question the letter exists to answer
   * — can my bench do these — could only be answered by opening the box. And a
   * count of the *catalogue* package is the wrong number wherever a file
   * splits: Ceramic Tiles routes its physical tests to one office and its
   * chemical ones to another, and each was told the package holds nine.
   */
  packages: { name: string; parameters: string[]; specimenCount: number }[];
  feePoisha: number | null;
  feePaid: boolean;
  /**
   * Urgent testing (D134). On the letter because it is an instruction about
   * *this* work — the wing head schedules a bench against it — and the paper is
   * where he reads the instruction.
   */
  urgent: boolean;
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
          isUrgent: true,
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
                  subProduct: { select: { nameEn: true, nameBn: true } },
                },
              },
              // **The tests routed here, read from the order rather than from
              // the catalogue.** A package's parameters may split across two
              // offices (D125), so the sub-product's own list is the wrong
              // answer for either of them. This is the crossing D133 named —
              // registration → sample → order (D70) — and it stays read-only.
              sample: {
                select: {
                  labTestOrder: {
                    select: {
                      id: true,
                      items: {
                        orderBy: { sortOrder: "asc" as const },
                        select: { parameter: { select: { nameEn: true, nameBn: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })
    : null;

  // One row per package in the box: how many jars, and which tests.
  //
  // Every specimen of a package points at the same order, so the parameters are
  // gathered per *order* and the jars counted per row — counting the tests once
  // per jar would print each name as many times as there are specimens.
  const packages = new Map<
    string,
    { name: string; parameters: string[]; specimenCount: number; orders: Set<number> }
  >();
  for (const r of box?.registry ?? []) {
    const sp = r.applicationSubProduct.subProduct;
    const name = sp.nameBn ?? sp.nameEn;
    let cur = packages.get(name);
    if (!cur) {
      cur = { name, parameters: [], specimenCount: 0, orders: new Set() };
      packages.set(name, cur);
    }
    cur.specimenCount++;
    const order = r.sample.labTestOrder;
    if (!cur.orders.has(order.id)) {
      cur.orders.add(order.id);
      for (const it of order.items) cur.parameters.push(it.parameter.nameBn ?? it.parameter.nameEn);
    }
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
    packages: [...packages.values()].map(({ name, parameters, specimenCount }) => ({
      name,
      parameters,
      specimenCount,
    })),
    feePoisha: l.application.testFeePoisha,
    feePaid: l.application.testFeePayment?.status === "paid",
    urgent: l.application.isUrgent,
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
