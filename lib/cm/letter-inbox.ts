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
 * **`/workflow/letters` is the counter's inbox only** (D138). A wing-head
 * letter *is* a work order — it says test these parameters on this package, and
 * `submitSamplingPlan()` has already written that same sentence as a
 * `LabTestOrder` — so listing it as a letter too made one instruction into two
 * destinations, and the wing head had to reconcile them himself. It is read at
 * `/workflow/work-order` now, through `lettersForWorkOrders()` below;
 * `internalLetterFor()` still serves the paper itself, because a letter is a
 * printed document and needs a page. **A counter letter is not a work order** —
 * the counter takes the box and never tests anything — so it keeps the inbox.
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
 * The letters at this person's **counter**, newest first (D138).
 *
 * Wing-head letters are deliberately not here — see the note at the top of the
 * file. `kind` survives on the row because the letter *page* still renders both
 * and the two read differently (D71: the counter's names the applicant, the
 * wing head's does not).
 */
export async function lettersForViewer(actor: WorkflowActor): Promise<LetterInboxRow[]> {
  if (!(hasRole(actor, "one_stop") && actor.officeId)) return [];

  const rows = await prisma.sampleLetter.findMany({
    where: { kind: "one_stop", officeId: actor.officeId },
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
  if (!(hasRole(actor, "one_stop") && actor.officeId)) return 0;
  return prisma.sampleLetter.count({ where: { kind: "one_stop", officeId: actor.officeId } });
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

/**
 * The letter each work order *is* — resolved for a whole board in one pass.
 *
 * **The FDO's wing-head letter and the `LabTestOrder` are one thing said
 * twice** (D137): the letter instructs an office to test named parameters on a
 * named package, and the order is that instruction as a row somebody works. The
 * two lived in different modules and neither pointed at the other, so a wing
 * head read the paper at `/workflow/letters` and did the work at a different
 * URL with no way across.
 *
 * **This is a CM-side read and it has to stay one.** `SampleRegistration` is
 * the cut (D71) — the only row where a specimen meets an applicant — and its
 * own comment is that nothing lab-facing reads it. So the join from order to
 * application lives here, beside the letter rules, rather than in
 * `lib/labs/board.ts`, which is blind by construction and must remain so. What
 * goes back is an **id and a letter number**, never a company.
 *
 * **Permission is the addressee, not standing on the order.** A wing-head
 * letter belongs to the officer named on it and to nobody else, which is the
 * rule `internalLetterFor()` already enforces — so the link is offered only to
 * somebody it will actually open for, rather than being offered to the bench
 * and refused on the click. An Assistant Director holding the order sees no
 * link because it is not his letter; he has the order, which says the same
 * thing.
 *
 * One query for the orders and one for the letters, whatever the board's size:
 * the round trip to Neon is the cost here, and a board of twenty orders
 * resolving one letter each would be twenty of them.
 */
export type WorkOrderLetter = {
  id: number;
  letterNo: string;
  issuedAt: Date;
  /** When the applicant was told to have the box in (D98, a stand-in). */
  dueOn: Date;
  issuedBy: { name: string; designation: string | null };
  /** Urgent testing, decided when the letters went out (D134). */
  urgent: boolean;
  /** The box cannot be received until this is settled (D129). */
  feePoisha: number | null;
  feePaid: boolean;
  boxCode: string | null;
  sealNo: string | null;
  submittedAt: Date | null;
  specimenCount: number;
};

export async function lettersForWorkOrders(
  orderIds: readonly number[],
  actor: WorkflowActor,
): Promise<Map<number, WorkOrderLetter>> {
  const found = new Map<number, WorkOrderLetter>();
  if (orderIds.length === 0) return found;
  if (!actor.employeeId && !hasRole(actor, "superadmin")) return found;

  // One specimen is enough: every specimen of an order is sealed into the box
  // for that order's office, which is what the unique on `Consignment`
  // (application, office) guarantees.
  const orders = await prisma.labTestOrder.findMany({
    where: { id: { in: [...orderIds] } },
    select: {
      id: true,
      officeId: true,
      specimens: {
        take: 1,
        select: { registry: { select: { consignment: { select: { applicationId: true } } } } },
      },
    },
  });

  const keyed = orders.flatMap((o) => {
    const applicationId = o.specimens[0]?.registry?.consignment.applicationId;
    // An order whose specimens are not sealed yet has no box and no letter.
    if (!applicationId || !o.officeId) return [];
    return [{ orderId: o.id, applicationId, officeId: o.officeId }];
  });
  if (keyed.length === 0) return found;

  const letters = await prisma.sampleLetter.findMany({
    where: {
      kind: "wing_head",
      OR: keyed.map((k) => ({ applicationId: k.applicationId, officeId: k.officeId })),
    },
    select: {
      id: true,
      letterNo: true,
      issuedAt: true,
      applicationId: true,
      officeId: true,
      addressedToEmployeeId: true,
      issuedBy: { select: { nameEn: true, designationEn: true, designationBn: true } },
      application: {
        select: {
          testFeePoisha: true,
          isUrgent: true,
          testFeePayment: { select: { status: true } },
        },
      },
    },
  });

  const isSuper = hasRole(actor, "superadmin");
  const mine = letters.filter((l) => isSuper || l.addressedToEmployeeId === actor.employeeId);
  if (mine.length === 0) return found;

  // The box each letter is about — one per (application, office), which is what
  // the unique on `Consignment` guarantees. One query for all of them.
  const boxes = await prisma.consignment.findMany({
    where: { applicationId: { in: [...new Set(mine.map((l) => l.applicationId))] } },
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

  const byKey = new Map(
    mine.map((l) => {
      const key = `${l.applicationId}:${l.officeId}`;
      const box = boxFor.get(key);
      return [
        key,
        {
          id: l.id,
          letterNo: l.letterNo,
          issuedAt: l.issuedAt,
          dueOn: sampleSubmissionDueOn(l.issuedAt),
          issuedBy: {
            name: l.issuedBy.nameEn,
            designation: l.issuedBy.designationEn ?? l.issuedBy.designationBn,
          },
          urgent: l.application.isUrgent,
          feePoisha: l.application.testFeePoisha,
          feePaid: l.application.testFeePayment?.status === "paid",
          boxCode: box?.code ?? null,
          sealNo: box?.sealNo ?? null,
          submittedAt: box?.submittedAt ?? null,
          specimenCount: box?._count.registry ?? 0,
        } satisfies WorkOrderLetter,
      ] as const;
    }),
  );

  for (const k of keyed) {
    const l = byKey.get(`${k.applicationId}:${k.officeId}`);
    if (l) found.set(k.orderId, l);
  }
  return found;
}
