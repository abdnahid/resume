/**
 * The laboratory's board — what is on this office's benches (D133).
 *
 * **Blind by construction.** Every select here stops at the catalogue: the
 * package, the specimens, the parameters, the state. Nothing joins to
 * `SampleRegistration`, so there is no path from this file to a company, a
 * brand or an application number — the variant *is* the applicant's identity
 * (D71), and testing-wing staff are the people it must be kept from.
 */
import { prisma } from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";
import { type LabActor, labDesksOfOffice, wingHeadsOfOffice } from "@/lib/labs/testing";
import { rungOf } from "@/lib/labs/ladder";

/**
 * Which orders this person may see.
 *
 * Standing is the same shape the CM board uses (D77): you hold it, you have
 * handled it, or you head the wing it belongs to. **Not office-wide** — an
 * office is not a wing, and a physical examiner has no business reading a
 * chemistry bench's readings.
 */
export async function ordersForViewer(actor: LabActor) {
  if (!actor.officeId) return [];

  const orders = await prisma.labTestOrder.findMany({
    where: await visibleOrdersWhere(actor, actor.officeId),
    select: {
      id: true,
      code: true,
      state: true,
      isUrgent: true,
      dueOn: true,
      receivedByWingAt: true,
      holderEmployeeId: true,
      holderRung: true,
      holder: { select: { nameEn: true, nameBn: true } },
      lab: { select: { nameEn: true, discipline: true } },
      subProduct: { select: { nameEn: true, product: { select: { nameEn: true } } } },
      report: { select: { reportNo: true, verdict: true } },
      _count: { select: { items: true, specimens: true } },
    },
    orderBy: [{ state: "asc" }, { id: "asc" }],
  });

  return orders;
}

/**
 * The standing filter, factored out so the list and its count cannot drift.
 *
 * A navbar that offers *Work orders* to somebody the board would then show
 * nothing to is the dead-link failure in a different costume, and the only way
 * to be sure the two agree is for them to ask the same question.
 */
async function visibleOrdersWhere(actor: LabActor, officeId: number) {
  // Heading a wing is derived from the desk now, so there is no role to test
  // first — gating on one is what kept this list empty at every office.
  const heads = await wingHeadsOfOffice(officeId);
  const mine = heads.find((h) => h.employeeId === actor.employeeId);
  if (hasAnyRole(actor, "superadmin")) return { officeId };

  return {
    officeId,
    OR: [
      { holderEmployeeId: actor.employeeId },
      { movements: { some: { toEmployeeId: actor.employeeId } } },
      { movements: { some: { fromEmployeeId: actor.employeeId } } },
      // A wing head sees everything coming to their own discipline, including
      // what has not been received yet — that is the letter they were sent
      // telling them to expect it.
      ...(mine ? [{ lab: { discipline: { in: mine.disciplines } } }, { labId: null }] : []),
    ],
  };
}

/**
 * How much testing work this person can see — for the `/workflow` navbar.
 *
 * A count rather than `ordersForViewer().length`: this runs on every workflow
 * screen to decide whether the tab exists, and the packages, specimens and
 * reports behind those rows are not wanted there. Same reasoning as
 * `letterCountForViewer()`.
 *
 * **Zero is the honest test for whether the tab belongs.** A CM officer has no
 * testing work and should not be offered a bench; a wing head gets the tab the
 * moment a letter is issued, because issuing it creates the order in
 * `awaiting_sample`.
 */
export async function workOrderCountForViewer(actor: LabActor): Promise<number> {
  if (!actor.officeId) return 0;
  return prisma.labTestOrder.count({ where: await visibleOrdersWhere(actor, actor.officeId) });
}

/** One order, in the shape the bench screen needs. Still blind. */
export async function orderDetail(orderId: number) {
  return prisma.labTestOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      code: true,
      state: true,
      officeId: true,
      isUrgent: true,
      dueOn: true,
      receivedByWingAt: true,
      receivedByWing: { select: { nameEn: true } },
      holderEmployeeId: true,
      holderRung: true,
      holder: { select: { nameEn: true, nameBn: true, designationEn: true } },
      office: { select: { nameEn: true, nameBn: true } },
      lab: { select: { nameEn: true, nameBn: true, discipline: true } },
      subProduct: {
        select: {
          nameEn: true,
          nameBn: true,
          standardAsPrinted: true,
          product: { select: { nameEn: true, bds: { select: { number: true, year: true } } } },
        },
      },
      specimens: {
        select: { id: true, labCode: true, specimenNo: true, state: true, conditionNote: true },
        orderBy: { specimenNo: "asc" },
      },
      movements: {
        select: {
          id: true,
          direction: true,
          note: true,
          createdAt: true,
          fromEmployee: { select: { nameEn: true } },
          toEmployee: { select: { nameEn: true } },
        },
        orderBy: { id: "asc" },
      },
      _count: { select: { items: true } },
    },
  });
}

/** May this person open this order at all? A refusal is `notFound()` (D71). */
export async function canViewOrder(actor: LabActor, orderId: number): Promise<boolean> {
  if (hasAnyRole(actor, "superadmin")) return true;
  const list = await ordersForViewer(actor);
  return list.some((o) => o.id === orderId);
}

/**
 * What this viewer may *do* to this order right now.
 *
 * Derived on the server and handed to the screen, so a control is never offered
 * that the service would refuse — and the service refuses anyway.
 */
export async function actionsFor(actor: LabActor, orderId: number) {
  const order = await prisma.labTestOrder.findUnique({
    where: { id: orderId },
    select: {
      state: true, officeId: true, holderEmployeeId: true, holderRung: true,
      // The boxes carrying this order's own specimens — the same read
      // `receiveByWing()` does, because this is the condition it refuses on.
      specimens: {
        select: { registry: { select: { consignment: { select: { code: true, state: true } } } } },
      },
    },
  });
  if (!order?.officeId) return null;

  const officeId = order.officeId;

  /**
   * Boxes this order is waiting on at the counter.
   *
   * **`receiveByWing()` refuses while any of them is outstanding, so the button
   * must not be offered while any of them is.** It was, and the refusal only
   * arrived on the click — which is exactly what the note above this function
   * promises does not happen. A wing head at Head Office saw *Mark samples
   * received* on three orders and two of them threw, because their box belongs
   * to a different application that has not been handed in.
   *
   * Named rather than counted, for the same reason the service names them: the
   * fix is to go and take that box in at the counter, and a number does not say
   * which.
   */
  const awaitingBoxes = [
    ...new Set(
      order.specimens
        .flatMap((s) => (s.registry?.consignment ? [s.registry.consignment] : []))
        .filter((c) => c.state !== "submitted" && c.state !== "received_at_lab")
        .map((c) => c.code),
    ),
  ];
  const holds = order.holderEmployeeId === actor.employeeId;
  const isSuper = hasAnyRole(actor, "superadmin");
  const heads = await wingHeadsOfOffice(officeId);
  const isHead = heads.some((h) => h.employeeId === actor.employeeId);
  /**
   * **A testing officer by the desk he is acting from, not by a grant** (the
   * client's rule, 2026-09-14). The order records the rung its holder took it
   * on, so this asks the only question that matters — is the desk holding this
   * work a bench or a supervising one.
   */
  const isTO = order.holderRung === "examiner" || order.holderRung === "assistant_director";

  return {
    holds,
    isHead,
    isTO,
    /** What the order is still waiting on at the counter; empty when nothing. */
    awaitingBoxes,
    canReceive:
      (isHead || isSuper) && order.state === "awaiting_sample" && awaitingBoxes.length === 0,
    canPass: (holds || isSuper) && ["received", "in_progress"].includes(order.state),
    canEnterResults:
      (holds || isSuper) && isTO && ["received", "in_progress"].includes(order.state),
    canSubmit: (holds || isSuper) && isTO && ["received", "in_progress"].includes(order.state),
    canCheck: (holds || isSuper) && order.state === "pending_check",
    canAuthorise: (holds || isSuper) && order.state === "pending_authorisation",
    canApprove: (isHead || isSuper) && order.state === "pending_approval",
    canReturn:
      (holds || isSuper) &&
      ["pending_check", "pending_authorisation", "pending_approval"].includes(order.state),
  };
}

/**
 * Does this office staff the ladder well enough to run a test at all?
 *
 * Surfaced on the board rather than discovered at the moment somebody tries to
 * hand work on — the same reason an empty pass-down list says which of its two
 * meanings applies. Eleven offices have only grade 9 in their CM section, and
 * a lab with a bench but no testing officer is a real and silent dead end.
 */
export async function ladderHealth(officeId: number) {
  const desks = await labDesksOfOffice(officeId);
  const heads = await wingHeadsOfOffice(officeId);
  const problems: string[] = [];
  // **Said as a seating problem, not a grant one** (D136). Both facts are read
  // from the organogram now, so "nobody holds the role" was advice nobody could
  // act on — there is no role to grant, and the screen used to send them to
  // /hr/listing/roles to grant it.
  if (!heads.length) {
    problems.push(
      "Nobody at this office sits on a wing head's desk, so no samples can be received.",
    );
  }
  if (!desks.some((d) => d.isTestingOfficer)) {
    problems.push(
      "Nobody at this office sits on an examiner's or assistant director's desk, so no result can be entered.",
    );
  }
  return { desks, heads, problems, rungsStaffed: desks.map((d) => d.rung) };
}

/** Kept so the board can say which rung a title would land on. */
export { rungOf };
