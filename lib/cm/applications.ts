/**
 * CM licence applications — the server half (D9).
 *
 * The applicant's side of spec §5: draft → application fee → submitted. Every
 * move below `submitted` belongs to the workflow engine and is deliberately not
 * reachable from here.
 */
import { prisma } from "@/lib/prisma";
import {
  missingForSubmission,
  applicationFeePoisha,
  bdsEditionPolicy,
  productEligibilityPolicy,
  purchaseOwnershipPolicy,
  salePricePolicy,
} from "./policy";
import { canApplicantMove } from "./states";
import { missingForSubmission as companyGaps } from "@/lib/client/organization";
import { raisePayment } from "@/lib/payments/service";
import type { ApplicationState } from "@/generated/prisma/client";

/** The product's standards, in the order the published list prints them. */
const PRODUCT_INCLUDE = {
  category: true,
  standards: {
    include: { bds: { include: { division: true } } },
    orderBy: [{ isPrimary: "desc" as const }, { bdsId: "asc" as const }],
  },
};

const APP_INCLUDE = {
  organization: { select: { id: true, nameEn: true, nameBn: true, type: true } },
  product: { include: PRODUCT_INCLUDE },
  attachedPurchases: { include: { bds: { include: { division: true } } } },
  skus: {
    include: {
      sizeType: { select: { id: true, slug: true, nameEn: true, nameBn: true, kind: true } },
      sizeUnit: { select: { id: true, code: true, nameEn: true } },
    },
    orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
  },
  factory: {
    include: { bstiOffice: { select: { id: true, nameEn: true, nameBn: true } } },
  },
  bstiOffice: { select: { id: true, nameEn: true, nameBn: true } },
  documents: { orderBy: { id: "asc" as const } },
  holder: { select: { nameEn: true, designationEn: true } },
  production: { include: { capacityUnit: { include: { sizeType: true } } } },
  answers: true,
  applicationFeePayment: true,
  events: { orderBy: { id: "desc" as const }, take: 20 },
};

/** Everything the applicant's screens need about one application. */
export async function getApplication(id: number) {
  return prisma.application.findUnique({ where: { id }, include: APP_INCLUDE });
}

/** Is this user entitled to act on this application? */
export async function membershipFor(userId: string, applicationId: number) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { organizationId: true },
  });
  if (!app) return null;
  return prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId: app.organizationId } },
  });
}

export async function applicationsFor(userId: string) {
  const memberships = await prisma.organizationMembership.findMany({
    where: { userId },
    select: { organizationId: true },
  });
  return prisma.application.findMany({
    where: { organizationId: { in: memberships.map((m) => m.organizationId) } },
    include: APP_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * What this application still needs, standard by standard.
 *
 * A product may name several standards and **all** of them are required (D48),
 * so the answer is not one list of purchases but one row per standard: what it
 * is, whether this file already holds it, which of the applicant's purchases
 * could satisfy it, and what it costs to buy if none can.
 *
 * Only purchases of **that** standard are considered — spec §3.3 check 3.
 * Showing every standard the applicant has ever bought and then refusing most
 * of them would be a list of near-misses rather than an answer.
 */
export type StandardRequirement = {
  bds: {
    id: number;
    number: string;
    titleEn: string;
    status: string;
    division: string;
  };
  asPrinted: string | null;
  isPrimary: boolean;
  /** The purchase already attached to this application for this standard. */
  attached: { id: number; purchaseNumber: string } | null;
  /** Unconsumed purchases of this standard the applicant could attach now. */
  options: {
    id: number;
    purchaseNumber: string;
    selectable: boolean;
    reason?: string;
    warning?: string;
  }[];
  /** Purchases of this standard that exist but cannot be used, and why. */
  blocked: { id: number; purchaseNumber: string; reason: string }[];
  /** What buying it here would cost, and whether that price is a stand-in. */
  price: { priceBdt: number; isProvisional: boolean; note?: string };
};

export async function requirementsFor(
  applicationId: number,
  userId: string,
): Promise<StandardRequirement[]> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      product: { include: PRODUCT_INCLUDE },
      attachedPurchases: { select: { id: true, bdsId: true, purchaseNumber: true } },
    },
  });
  if (!app?.product) return [];

  const bdsIds = app.product.standards.map((s) => s.bdsId);
  if (bdsIds.length === 0) return [];

  const purchases = await prisma.bdsPurchase.findMany({
    where: {
      buyerUserId: userId,
      bdsId: { in: bdsIds },
      payment: { status: "paid" },
    },
    orderBy: { purchasedAt: "desc" },
  });

  // Which application took each consumed purchase, so the applicant is told
  // *which* file has it rather than just "already used" (spec §3.4).
  const consumingIds = [
    ...new Set(
      purchases
        .map((p) => p.consumedByApplicationId)
        .filter((x): x is number => x !== null && x !== applicationId),
    ),
  ];
  const consumers = consumingIds.length
    ? await prisma.application.findMany({
        where: { id: { in: consumingIds } },
        select: { id: true, applicationNo: true },
      })
    : [];
  const consumerById = new Map(consumers.map((c) => [c.id, c]));
  const attachedByBds = new Map(app.attachedPurchases.map((p) => [p.bdsId, p]));

  return app.product.standards.map((link) => {
    const mine = purchases.filter((p) => p.bdsId === link.bdsId);
    const attached = attachedByBds.get(link.bdsId) ?? null;

    const options: StandardRequirement["options"] = [];
    const blocked: StandardRequirement["blocked"] = [];

    for (const p of mine) {
      if (attached && p.id === attached.id) continue;
      const owner = purchaseOwnershipPolicy(p.organizationId, app.organizationId);
      const edition = bdsEditionPolicy(link.bds.status);
      const consumedBy = p.consumedByApplicationId
        ? (consumerById.get(p.consumedByApplicationId) ?? null)
        : null;

      if (consumedBy) {
        blocked.push({
          id: p.id,
          purchaseNumber: p.purchaseNumber,
          reason: `Already used on application ${consumedBy.applicationNo ?? `#${consumedBy.id}`}.`,
        });
      } else if (!owner.allowed) {
        blocked.push({ id: p.id, purchaseNumber: p.purchaseNumber, reason: owner.reason! });
      } else if (!edition.allowed) {
        blocked.push({ id: p.id, purchaseNumber: p.purchaseNumber, reason: edition.reason! });
      } else {
        options.push({
          id: p.id,
          purchaseNumber: p.purchaseNumber,
          selectable: true,
          warning: edition.warning,
        });
      }
    }

    return {
      bds: {
        id: link.bds.id,
        number: link.bds.number,
        titleEn: link.bds.titleEn,
        status: link.bds.status as string,
        division: link.bds.division.nameEn,
      },
      asPrinted: link.asPrinted,
      isPrimary: link.isPrimary,
      attached: attached
        ? { id: attached.id, purchaseNumber: attached.purchaseNumber }
        : null,
      options,
      blocked,
      price: salePricePolicy(link.bds),
    };
  });
}

/** Start a draft. Nothing beyond the entity and the premises is needed yet. */
export async function createApplication(args: {
  organizationId: number;
  factoryId: number;
  userId: string;
}) {
  const factory = await prisma.factory.findUnique({
    where: { id: args.factoryId },
    select: { organizationId: true },
  });
  if (!factory) throw new Error("Factory not found.");
  if (factory.organizationId !== args.organizationId) {
    throw new Error("That factory belongs to a different company.");
  }

  return prisma.application.create({
    data: {
      organizationId: args.organizationId,
      factoryId: args.factoryId,
      createdBy: args.userId,
      events: { create: { kind: "created", state: "draft", actorUserId: args.userId } },
    },
    include: APP_INCLUDE,
  });
}

/**
 * Attach a purchased standard — the one-purchase-one-application rule (§3.3).
 *
 * The spec is explicit that the UI is not the enforcement point. Three layers,
 * all present:
 *
 *   1. the single scalar `BdsPurchase.consumedByApplicationId` — a purchase
 *      points at one application or at none;
 *   2. these application-layer checks (ownership, edition, right standard,
 *      already consumed);
 *   3. a conditional `updateMany` inside a transaction, which is the lock —
 *      two requests racing both pass the checks, but only the first matches
 *      `consumedByApplicationId: null` and the second gets zero rows.
 *
 * The unique index that used to sit on that column is gone (D48): it enforced
 * one purchase *per application*, which a multi-standard product makes wrong.
 * The direction that matters is enforced by the column and the lock, both of
 * which are untouched.
 */
export async function attachBds(applicationId: number, purchaseId: number, userId: string) {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      product: { include: { standards: { select: { bdsId: true } } } },
      attachedPurchases: { select: { id: true, bdsId: true } },
    },
  });
  if (app.state !== "draft" && app.state !== "pending_app_fee") {
    throw new Error("This application can no longer be edited.");
  }

  // Standing on the file, checked here rather than only at the route. The
  // routes do check it, but they are not the only caller: `fulfilPayment()`
  // attaches an in-flow purchase (D50) straight from a settled payment, and a
  // rule enforced only where the button is, is a rule that holds only for
  // people who used the button.
  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId: app.organizationId } },
  });
  if (!membership || membership.role === "viewer") {
    throw new Error("You do not have permission to add standards to this application.");
  }

  const purchase = await prisma.bdsPurchase.findUnique({
    where: { id: purchaseId },
    include: { bds: true, payment: { select: { status: true } } },
  });
  if (!purchase) throw new Error("Purchase not found.");
  if (purchase.buyerUserId !== userId) throw new Error("That purchase is not yours.");
  if (purchase.payment.status !== "paid") throw new Error("That purchase has not been paid for.");

  // Spec §3.3 check 3 — the standard attached must be one the product being
  // certified is actually made to. The Product ↔ Bds join is what makes this a
  // real test rather than a stub (D44).
  if (!app.product) {
    throw new Error("Choose the product you are certifying before attaching a standard.");
  }
  const required = new Set(app.product.standards.map((s) => s.bdsId));
  if (!required.has(purchase.bdsId)) {
    throw new Error(
      `${app.product.nameEn} is not certified against ${purchase.bds.number}, so that purchase cannot be used on this application.`,
    );
  }

  // One purchase per standard. A second copy of a part already covered adds
  // nothing and would silently consume a purchase the applicant could use
  // elsewhere.
  const already = app.attachedPurchases.find((p) => p.bdsId === purchase.bdsId);
  if (already && already.id !== purchaseId) {
    throw new Error(
      `${purchase.bds.number} is already attached to this application. Detach the current one first if you meant to swap it.`,
    );
  }
  if (already?.id === purchaseId) return app;

  const owner = purchaseOwnershipPolicy(purchase.organizationId, app.organizationId);
  if (!owner.allowed) throw new Error(owner.reason);

  const edition = bdsEditionPolicy(purchase.bds.status);
  if (!edition.allowed) throw new Error(edition.reason);

  return prisma.$transaction(async (tx) => {
    // The lock. Only an unconsumed purchase matches.
    const claimed = await tx.bdsPurchase.updateMany({
      where: { id: purchaseId, consumedByApplicationId: null },
      data: { consumedByApplicationId: applicationId },
    });
    if (claimed.count === 0) {
      throw new Error("That standard has already been used on another application.");
    }

    return tx.application.update({
      where: { id: applicationId },
      data: {
        events: {
          create: {
            kind: "bds_attached",
            note: purchase.bds.number,
            actorUserId: userId,
          },
        },
      },
      include: APP_INCLUDE,
    });
  });
}

/**
 * Release a purchase from this application.
 *
 * Released, never consumed: an applicant who attached the wrong copy, or who is
 * abandoning a draft, must not lose the standard they paid for. Only reachable
 * while the file is still the applicant's to edit — once it is submitted the
 * purchase is spent against the review it bought.
 */
export async function detachBds(applicationId: number, purchaseId: number, userId: string) {
  const app = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
  if (app.state !== "draft" && app.state !== "pending_app_fee") {
    throw new Error("This application can no longer be edited.");
  }

  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId: app.organizationId } },
  });
  if (!membership || membership.role === "viewer") {
    throw new Error("You do not have permission to change this application.");
  }

  const purchase = await prisma.bdsPurchase.findUnique({
    where: { id: purchaseId },
    include: { bds: { select: { number: true } } },
  });
  if (!purchase) throw new Error("Purchase not found.");
  if (purchase.buyerUserId !== userId) throw new Error("That purchase is not yours.");

  return prisma.$transaction(async (tx) => {
    const released = await tx.bdsPurchase.updateMany({
      where: { id: purchaseId, consumedByApplicationId: applicationId },
      data: { consumedByApplicationId: null },
    });
    if (released.count === 0) throw new Error("That purchase is not attached to this application.");

    return tx.application.update({
      where: { id: applicationId },
      data: {
        events: {
          create: { kind: "bds_detached", note: purchase.bds.number, actorUserId: userId },
        },
      },
      include: APP_INCLUDE,
    });
  });
}

/**
 * Choose the product being certified — one of the mandatory 315 (D44).
 *
 * Changing it releases every purchase attached for the old product: those
 * standards certify a different article, and leaving them attached would let an
 * application reach submission carrying standards that have nothing to do with
 * what it is for. Released rather than consumed, so they stay usable elsewhere
 * — changing your mind in a draft must not destroy a purchase (D41).
 */
export async function setProduct(applicationId: number, productId: number, userId: string) {
  const app = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
  if (app.state !== "draft" && app.state !== "pending_app_fee") {
    throw new Error("This application can no longer be edited.");
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { standards: { select: { bdsId: true } } },
  });
  if (!product) throw new Error("That product is not on BSTI's list.");

  // The closed list of 315 (spec §1). A CM licence is the mandatory quality
  // licence; a product outside that list is not something BSTI licences, so it
  // is refused here rather than at submission.
  const eligible = productEligibilityPolicy(product);
  if (!eligible.allowed) throw new Error(eligible.reason);

  if (app.productId === productId) return app;

  return prisma.$transaction(async (tx) => {
    await tx.bdsPurchase.updateMany({
      where: { consumedByApplicationId: applicationId },
      data: { consumedByApplicationId: null },
    });
    return tx.application.update({
      where: { id: applicationId },
      data: {
        productId,
        events: {
          create: {
            kind: "product_chosen",
            note: product.nameEn,
            actorUserId: userId,
          },
        },
      },
    });
  });
}

/** What still stands between this application and submission. */
export async function gapsFor(applicationId: number) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      documents: { select: { kind: true } },
      organization: { include: { factories: { select: { id: true } } } },
      product: {
        include: { standards: { include: { bds: { select: { id: true, number: true } } } } },
      },
      attachedPurchases: { select: { bdsId: true } },
      production: { select: { annualCapacityValue: true, currentYearLabel: true } },
      answers: { select: { questionKey: true, answerText: true, answerNumber: true } },
      _count: { select: { skus: true } },
    },
  });
  if (!app) return null;

  // All of the product's standards are required (D48), so the gap list names
  // each one that is still missing rather than the set as a whole.
  const attached = new Set(app.attachedPurchases.map((p) => p.bdsId));

  return missingForSubmission({
    productId: app.productId,
    product: app.product,
    standards: (app.product?.standards ?? []).map((s) => ({
      number: s.bds.number,
      attached: attached.has(s.bds.id),
    })),
    skuCount: app._count.skus,
    factoryId: app.factoryId,
    documents: app.documents,
    organizationComplete: companyGaps(app.organization).length === 0,
    production: app.production,
    answers: app.answers,
    consentAcceptedAt: app.consentAcceptedAt,
  });
}

/**
 * Raise the application fee and move to `pending_app_fee`.
 *
 * Refuses while anything is still missing: a fee demanded against an incomplete
 * file produces a payment that cannot be used, and refunds are not modelled.
 */
export async function raiseApplicationFee(applicationId: number, userId: string) {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { applicationFeePayment: true },
  });

  if (app.state === "pending_app_fee" && app.applicationFeePayment?.status !== "paid") {
    // Already raised and still unpaid — reuse it rather than stacking demands.
    return app.applicationFeePayment
      ? { payment: app.applicationFeePayment, reused: true }
      : { payment: null, reused: false };
  }

  if (!canApplicantMove(app.state, "pending_app_fee")) {
    throw new Error("This application is not ready for the fee.");
  }

  const gaps = await gapsFor(applicationId);
  if (gaps && gaps.length > 0) {
    throw new Error(`Still needed before the fee can be raised: ${gaps.map((g) => g.label).join(", ")}.`);
  }

  const payment = await raisePayment({
    purpose: "application_fee",
    subjectType: "application",
    subjectId: String(applicationId),
    incomePoisha: applicationFeePoisha(),
    payerUserId: userId,
    organizationId: app.organizationId,
  });

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      state: "pending_app_fee",
      applicationFeePaymentId: payment.id,
      events: {
        create: {
          kind: "fee_raised",
          state: "pending_app_fee",
          note: payment.reference,
          actorUserId: userId,
        },
      },
    },
  });

  return { payment, reused: false };
}

/** `CM-2026-000123`, assigned at submission. */
function applicationNumber(id: number, year: number): string {
  return `CM-${year}-${String(id).padStart(6, "0")}`;
}

/**
 * Submit — the last move the applicant makes.
 *
 * Called after the fee settles. Idempotent, and guarded on the fee actually
 * being paid rather than on the caller saying so: this runs from the payment
 * return page, which anyone can navigate to.
 */
export async function submitApplication(applicationId: number): Promise<{
  state: ApplicationState;
  applicationNo: string | null;
  newlySubmitted: boolean;
  reason?: string;
}> {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      applicationFeePayment: true,
      factory: { select: { bstiOfficeId: true } },
    },
  });

  if (app.state !== "pending_app_fee") {
    return {
      state: app.state,
      applicationNo: app.applicationNo,
      newlySubmitted: false,
      reason: app.state === "draft" ? "The application fee has not been raised." : undefined,
    };
  }

  if (app.applicationFeePayment?.status !== "paid") {
    return {
      state: app.state,
      applicationNo: null,
      newlySubmitted: false,
      reason: "The application fee has not been paid.",
    };
  }

  const gaps = await gapsFor(applicationId);
  if (gaps && gaps.length > 0) {
    return {
      state: app.state,
      applicationNo: null,
      newlySubmitted: false,
      reason: `Still incomplete: ${gaps.map((g) => g.label).join(", ")}.`,
    };
  }

  // The conditional update is the idempotency guard — two callers racing (the
  // payment return page and the IPN) both see a paid fee, but only one moves
  // the row, so only one assigns a number.
  const claimed = await prisma.application.updateMany({
    where: { id: applicationId, state: "pending_app_fee" },
    data: {
      state: "submitted",
      submittedAt: new Date(),
      // The routing path is snapshotted here, not read live at each hop
      // (spec §4.2): a jurisdiction redrawn next year must not move a file
      // that is already in flight.
      bstiOfficeId: app.factory.bstiOfficeId,
      applicationNo: applicationNumber(applicationId, new Date().getFullYear()),
    },
  });

  if (claimed.count === 0) {
    const now = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
    return { state: now.state, applicationNo: now.applicationNo, newlySubmitted: false };
  }

  const submitted = await prisma.application.update({
    where: { id: applicationId },
    data: {
      events: {
        create: {
          kind: "submitted",
          state: "submitted",
          note: "Received by BSTI.",
        },
      },
    },
  });

  return {
    state: submitted.state,
    applicationNo: submitted.applicationNo,
    newlySubmitted: true,
  };
}
