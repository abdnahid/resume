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

  const heads = hasAnyRole(actor, "wing_head")
    ? await wingHeadsOfOffice(actor.officeId)
    : [];
  const mine = heads.find((h) => h.employeeId === actor.employeeId);
  const isSuper = hasAnyRole(actor, "superadmin");

  const orders = await prisma.labTestOrder.findMany({
    where: {
      officeId: actor.officeId,
      ...(isSuper
        ? {}
        : {
            OR: [
              { holderEmployeeId: actor.employeeId },
              { movements: { some: { toEmployeeId: actor.employeeId } } },
              { movements: { some: { fromEmployeeId: actor.employeeId } } },
              // A wing head sees everything coming to their own discipline,
              // including what has not been received yet — that is the letter
              // they were sent telling them to expect it.
              ...(mine
                ? [{ lab: { discipline: { in: mine.disciplines } } }, { labId: null }]
                : []),
            ],
          }),
    },
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
    select: { state: true, officeId: true, holderEmployeeId: true, holderRung: true },
  });
  if (!order?.officeId) return null;

  const officeId = order.officeId;
  const holds = order.holderEmployeeId === actor.employeeId;
  const isSuper = hasAnyRole(actor, "superadmin");
  const heads = hasAnyRole(actor, "wing_head") ? await wingHeadsOfOffice(officeId) : [];
  const isHead = heads.some((h) => h.employeeId === actor.employeeId);
  const isTO = hasAnyRole(actor, "testing_officer");

  return {
    holds,
    isHead,
    isTO,
    canReceive: (isHead || isSuper) && order.state === "awaiting_sample",
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
  if (!heads.length) {
    problems.push(
      "Nobody at this office holds the wing head role, so no samples can be received.",
    );
  }
  if (!desks.some((d) => d.isTestingOfficer)) {
    problems.push(
      "Nobody at this office holds the testing officer role, so no result can be entered.",
    );
  }
  return { desks, heads, problems, rungsStaffed: desks.map((d) => d.rung) };
}

/** Kept so the board can say which rung a title would land on. */
export { rungOf };
