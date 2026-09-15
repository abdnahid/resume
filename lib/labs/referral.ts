/**
 * Sending a test out, and getting the figures back (D140).
 *
 * The client's rule, 2026-09-15: *"3rd party is handled by that office's TO. he
 * issues a letter from system and gives to 3rd party manually and then after
 * taking data from them TO enters that into our system."*
 *
 * **Capability and referral are different facts and this module is the second
 * one.** `ParameterCapability.manner = third_party` is a standing declaration —
 * this office does not run this test on its own bench — with no date, no
 * laboratory and no paper. A referral is one event on one order. The declaration
 * is what makes the office a valid destination (D116); the referral is what
 * actually happened to a jar.
 *
 * **The office stays accountable** (D65). Its own testing officer issues the
 * referral, receives the figures and enters them, and the report is BSTI's with
 * BSTI's signatures. Nothing here moves the order to another office — that is
 * routing, and it is a different question answered before the samples were ever
 * sealed.
 *
 * **Blind by construction, and here it matters most.** Everything is built from
 * the order, which carries no application column at all (D70), so a referral
 * letter names specimens by lab code and cannot name the applicant even by
 * accident. This is the one document in the system that leaves the building.
 *
 * Server half (D9); `lib/labs/ladder.ts` holds what needs no database.
 */
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/roles";
import { memoOfficeLabel } from "@/lib/bengali";
import { type LabActor, isTestingRung } from "@/lib/labs/testing";

/** The states in which an order's tests may still be sent out or entered. */
const OPEN_STATES = ["received", "in_progress"] as const;

/**
 * The order, with the one question every write here asks: may *this* person act
 * on it now.
 *
 * **The same guard `enterResult()` uses**, deliberately. Issuing a referral and
 * typing the figure it comes back with are two halves of one job, and the
 * client named one person for it — the office's testing officer. A rule that
 * let a wing head issue the letter but not enter the result would split that
 * job across two desks for no reason anybody could act on.
 */
async function guardedOrder(orderId: number, actor: LabActor) {
  const order = await prisma.labTestOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true, code: true, state: true, officeId: true,
      holderEmployeeId: true, holderRung: true,
      office: { select: { nameEn: true, nameBn: true } },
    },
  });
  if (!order) throw new Error("No such test order.");

  const isSuper = hasRole(actor, "superadmin");
  if (order.holderEmployeeId !== actor.employeeId && !isSuper) {
    throw new Error("This order is on somebody else's bench.");
  }
  if (!isTestingRung(order.holderRung) && !isSuper) {
    throw new Error(
      "Only a testing officer may send a test out. Pass the order to a bench first.",
    );
  }
  if (!OPEN_STATES.includes(order.state as (typeof OPEN_STATES)[number])) {
    throw new Error("The report has gone up — a test cannot be sent out now.");
  }
  return order;
}

export type ReferrableItem = {
  orderItemId: number;
  parameterId: number;
  nameEn: string;
  nameBn: string | null;
  discipline: string;
  method: string | null;
  limitText: string | null;
  /** What this office declared about the test at `/labs/coverage`. */
  declared: "in_house" | "third_party" | "not_covered";
  /** The referral it is already on, if any. */
  referral: { id: number; referralNo: string; labName: string } | null;
};

/**
 * Every test on the order, with what the office declared about it and whether
 * it has already gone out.
 *
 * **The declaration is shown, not enforced.** An office that declared a test
 * in-house may still have to send it out — an instrument fails, a reagent runs
 * out — and refusing that would leave a testing officer with a jar he can
 * neither test nor refer, which is a dead end with no way out of it. So the
 * form pre-selects what capability says and lets him say otherwise. What it
 * must never do is hide the disagreement: a test declared *our bench* and sent
 * out anyway is worth seeing on the screen.
 */
export async function referrableItems(orderId: number): Promise<ReferrableItem[]> {
  const order = await prisma.labTestOrder.findUnique({
    where: { id: orderId },
    select: {
      officeId: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          parameter: {
            select: {
              id: true, nameEn: true, nameBn: true, discipline: true, limitText: true,
              method: { select: { designation: true } },
            },
          },
          referral: {
            select: {
              referral: { select: { id: true, referralNo: true, labName: true } },
            },
          },
        },
      },
    },
  });
  if (!order) return [];

  const caps = order.officeId
    ? await prisma.parameterCapability.findMany({
        where: {
          officeId: order.officeId,
          parameterId: { in: order.items.map((i) => i.parameter.id) },
        },
        select: { parameterId: true, manner: true },
      })
    : [];
  const declaredBy = new Map(caps.map((c) => [c.parameterId, c.manner]));

  return order.items.map((i) => ({
    orderItemId: i.id,
    parameterId: i.parameter.id,
    nameEn: i.parameter.nameEn,
    nameBn: i.parameter.nameBn,
    discipline: i.parameter.discipline,
    method: i.parameter.method?.designation ?? null,
    limitText: i.parameter.limitText,
    declared: declaredBy.get(i.parameter.id) ?? "not_covered",
    referral: i.referral?.referral ?? null,
  }));
}

/**
 * `বিএসটিআই/<office>/বহিঃপরীক্ষণ/<serial>/<year>` — its own series.
 *
 * Not shared with the sampling letters' `নমুনা` run: those are the CM side's
 * and are numbered per issuing office, while this is the testing office's own
 * paper. One series numbering two unrelated kinds of document makes a gap in it
 * meaningless, and a gap is the only thing a serial is for.
 */
async function nextReferralNo(officeId: number | null, officeNameBn: string | null) {
  const year = new Date().getFullYear();
  const label = officeNameBn ? memoOfficeLabel(officeNameBn) : "ঢাকা";
  const prefix = `বিএসটিআই/${label}/বহিঃপরীক্ষণ/`;
  const suffix = `/${year}`;
  const rows = await prisma.labReferral.findMany({
    where: { referralNo: { startsWith: prefix, endsWith: suffix } },
    select: { referralNo: true },
  });
  const highest = rows.reduce((max, r) => {
    const n = Number(r.referralNo.slice(prefix.length, r.referralNo.length - suffix.length));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}${suffix}`;
}

/**
 * Send a batch of this order's tests to a named outside laboratory.
 *
 * One referral, any number of tests — because capability is per parameter and
 * an order is routinely split: Faridpur runs four of Ceramic Tiles' nine on its
 * own bench and sends three out. Issuing one referral per test would hand the
 * courier three envelopes for one jar.
 */
export async function issueReferral(args: {
  orderId: number;
  orderItemIds: number[];
  labName: string;
  labAddress?: string | null;
  note?: string | null;
  actor: LabActor;
}) {
  const order = await guardedOrder(args.orderId, args.actor);

  const labName = args.labName.trim();
  if (!labName) throw new Error("Name the laboratory this is going to.");
  if (!args.orderItemIds.length) throw new Error("Choose at least one test to send out.");

  const items = await prisma.labTestOrderItem.findMany({
    where: { id: { in: args.orderItemIds } },
    select: {
      id: true, orderId: true,
      parameter: { select: { nameEn: true } },
      referral: { select: { referral: { select: { referralNo: true } } } },
    },
  });
  if (items.length !== new Set(args.orderItemIds).size) {
    throw new Error("One of those tests is not on this order.");
  }

  const foreign = items.filter((i) => i.orderId !== args.orderId);
  if (foreign.length) throw new Error("One of those tests belongs to a different order.");

  // **Named, not counted.** The fix is to withdraw the other referral or drop
  // the test from this one, and a number says neither.
  const already = items.filter((i) => i.referral);
  if (already.length) {
    throw new Error(
      `Already sent out: ${already
        .map((i) => `“${i.parameter.nameEn}” on ${i.referral!.referral.referralNo}`)
        .join(", ")}. Withdraw that referral first if it was wrong.`,
    );
  }

  const referralNo = await nextReferralNo(order.officeId, order.office?.nameBn ?? null);

  return prisma.labReferral.create({
    data: {
      referralNo,
      orderId: args.orderId,
      labName,
      labAddress: args.labAddress?.trim() || null,
      note: args.note?.trim() || null,
      issuedByEmployeeId: args.actor.employeeId,
      items: { create: items.map((i) => ({ orderItemId: i.id })) },
    },
    select: { id: true, referralNo: true },
  });
}

/**
 * Take a referral back, freeing its tests.
 *
 * **Only while nothing has come back.** Once a reading has been entered against
 * it the referral is part of the record of how that figure was obtained, and
 * deleting it would leave a result whose provenance silently became "our own
 * bench". The escape it exists for is the mistyped laboratory name, which is
 * always noticed before any figure arrives.
 */
export async function withdrawReferral(args: { referralId: number; actor: LabActor }) {
  const referral = await prisma.labReferral.findUnique({
    where: { id: args.referralId },
    select: { id: true, orderId: true, referralNo: true, _count: { select: { results: true } } },
  });
  if (!referral) throw new Error("No such referral.");
  await guardedOrder(referral.orderId, args.actor);

  if (referral._count.results > 0) {
    throw new Error(
      `${referral.referralNo} already has results entered against it, so it is part of how those figures were obtained. Correct the readings instead.`,
    );
  }

  await prisma.labReferral.delete({ where: { id: referral.id } });
  return { withdrawn: referral.referralNo };
}

/** Every referral on an order, newest first, with what went out on each. */
export async function referralsFor(orderId: number) {
  return prisma.labReferral.findMany({
    where: { orderId },
    orderBy: { id: "desc" },
    select: {
      id: true,
      referralNo: true,
      labName: true,
      labAddress: true,
      issuedAt: true,
      resultsInAt: true,
      note: true,
      issuedBy: { select: { nameEn: true, designationEn: true, designationBn: true } },
      items: {
        select: {
          orderItem: {
            select: { id: true, parameter: { select: { nameEn: true, discipline: true } } },
          },
        },
      },
      _count: { select: { results: true } },
    },
  });
}

/**
 * The referral letter, as a document.
 *
 * **Access is the order's** — `canViewOrder()` is asked by the route, the same
 * rule that governs every other lab screen, and a refusal is `notFound()` per
 * D71.
 *
 * Note what is *not* selected: no application, no organisation, no brand. The
 * order has no path to them (D70) and this letter least of all may find one.
 */
export async function referralDocument(referralId: number) {
  const r = await prisma.labReferral.findUnique({
    where: { id: referralId },
    select: {
      id: true,
      referralNo: true,
      labName: true,
      labAddress: true,
      issuedAt: true,
      note: true,
      issuedBy: { select: { nameEn: true, designationEn: true, designationBn: true } },
      order: {
        select: {
          id: true,
          code: true,
          isUrgent: true,
          office: { select: { nameEn: true, nameBn: true, addressBn: true, email: true } },
          subProduct: {
            select: {
              nameEn: true, nameBn: true, standardAsPrinted: true,
              product: { select: { nameEn: true, nameBn: true } },
            },
          },
          specimens: {
            select: { id: true, labCode: true, specimenNo: true },
            orderBy: { specimenNo: "asc" },
          },
        },
      },
      items: {
        select: {
          orderItem: {
            select: {
              parameter: {
                select: {
                  nameEn: true, nameBn: true, discipline: true, limitText: true,
                  method: { select: { designation: true } },
                  subParameters: {
                    orderBy: { ordinal: "asc" },
                    select: { label: true, limitText: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  return r;
}
