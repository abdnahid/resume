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
} from "./policy";
import { canApplicantMove } from "./states";
import { missingForSubmission as companyGaps } from "@/lib/client/organization";
import { raisePayment } from "@/lib/payments/service";
import type { ApplicationState } from "@/generated/prisma/client";

const APP_INCLUDE = {
  organization: { select: { id: true, nameEn: true, nameBn: true, type: true } },
  bds: { include: { division: true } },
  factory: {
    include: { bstiOffice: { select: { id: true, nameEn: true, nameBn: true } } },
  },
  bstiOffice: { select: { id: true, nameEn: true, nameBn: true } },
  documents: { orderBy: { id: "asc" as const } },
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
 * Purchases this company may attach, with why each one can or cannot be used.
 *
 * When the application has chosen its product, only purchases of **that**
 * standard are considered — spec §3.3 check 3. Showing every standard the
 * applicant has ever bought and then refusing most of them would be a list of
 * near-misses rather than an answer.
 */
export async function attachableBds(
  organizationId: number,
  userId: string,
  bdsId: number | null,
) {
  const purchases = await prisma.bdsPurchase.findMany({
    where: {
      buyerUserId: userId,
      payment: { status: "paid" },
      ...(bdsId ? { bdsId } : {}),
    },
    include: {
      bds: { include: { division: true } },
      // What consumed it, so the applicant is told *which* application rather
      // than just "already used" (spec §3.4).
      payment: { select: { status: true } },
    },
    orderBy: { purchasedAt: "desc" },
  });

  const consumingIds = purchases
    .map((p) => p.consumedByApplicationId)
    .filter((x): x is number => x !== null);
  const consumers = consumingIds.length
    ? await prisma.application.findMany({
        where: { id: { in: consumingIds } },
        select: { id: true, applicationNo: true },
      })
    : [];
  const consumerById = new Map(consumers.map((c) => [c.id, c]));

  return purchases.map((p) => {
    const owner = purchaseOwnershipPolicy(p.organizationId, organizationId);
    const edition = bdsEditionPolicy(p.bds.status);
    const consumedBy = p.consumedByApplicationId
      ? (consumerById.get(p.consumedByApplicationId) ?? null)
      : null;

    return {
      id: p.id,
      purchaseNumber: p.purchaseNumber,
      bds: {
        id: p.bds.id,
        number: p.bds.number,
        titleEn: p.bds.titleEn,
        status: p.bds.status as string,
        division: p.bds.division.nameEn,
      },
      consumedBy,
      /** Usable right now on this application. */
      selectable: owner.allowed && edition.allowed && consumedBy === null,
      reason: consumedBy
        ? `Already used on application ${consumedBy.applicationNo ?? `#${consumedBy.id}`}.`
        : !owner.allowed
          ? owner.reason
          : !edition.allowed
            ? edition.reason
            : undefined,
      warning: edition.warning,
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
 *   1. the UNIQUE index on `BdsPurchase.consumedByApplicationId`;
 *   2. these application-layer checks (ownership, edition, already consumed);
 *   3. a conditional `updateMany` inside a transaction, which is the lock —
 *      two requests racing both pass the checks, but only the first matches
 *      `consumedByApplicationId: null` and the second gets zero rows.
 */
export async function attachBds(applicationId: number, purchaseId: number, userId: string) {
  const app = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
  if (app.state !== "draft" && app.state !== "pending_app_fee") {
    throw new Error("This application can no longer be edited.");
  }

  const purchase = await prisma.bdsPurchase.findUnique({
    where: { id: purchaseId },
    include: { bds: true, payment: { select: { status: true } } },
  });
  if (!purchase) throw new Error("Purchase not found.");
  if (purchase.buyerUserId !== userId) throw new Error("That purchase is not yours.");
  if (purchase.payment.status !== "paid") throw new Error("That purchase has not been paid for.");

  // Spec §3.3 check 3 — the standard attached must be the standard the
  // application is for. The product *is* the BDS, so this is an equality test
  // rather than the product-code join the spec assumed.
  if (!app.bdsId) {
    throw new Error("Choose the product you are certifying before attaching a standard.");
  }
  if (purchase.bdsId !== app.bdsId) {
    throw new Error(
      `This application is for ${(await prisma.bds.findUnique({ where: { id: app.bdsId }, select: { number: true } }))?.number ?? "another standard"}, but that purchase is for ${purchase.bds.number}.`,
    );
  }

  const owner = purchaseOwnershipPolicy(purchase.organizationId, app.organizationId);
  if (!owner.allowed) throw new Error(owner.reason);

  const edition = bdsEditionPolicy(purchase.bds.status);
  if (!edition.allowed) throw new Error(edition.reason);

  return prisma.$transaction(async (tx) => {
    // Release whatever was attached before, so swapping the standard on a draft
    // does not strand the old purchase as permanently consumed.
    if (app.bdsPurchaseId && app.bdsPurchaseId !== purchaseId) {
      await tx.bdsPurchase.updateMany({
        where: { id: app.bdsPurchaseId, consumedByApplicationId: applicationId },
        data: { consumedByApplicationId: null },
      });
    }

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
        bdsPurchaseId: purchaseId,
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
 * Choose the product — that is, the standard being certified against.
 *
 * Changing it detaches whatever purchase was attached: a purchase of the old
 * standard cannot certify the new product, and leaving it attached would let an
 * application reach submission with a standard that does not match its product.
 * The purchase is released rather than consumed, so it stays usable elsewhere.
 */
export async function setProduct(applicationId: number, bdsId: number, userId: string) {
  const app = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
  if (app.state !== "draft" && app.state !== "pending_app_fee") {
    throw new Error("This application can no longer be edited.");
  }

  const bds = await prisma.bds.findUnique({ where: { id: bdsId } });
  if (!bds) throw new Error("That standard is not in the catalogue.");

  // The closed list of 315 (spec §1). A CM licence is the mandatory quality
  // licence; a standard outside that list is not something BSTI licences, so
  // it is refused here rather than at submission.
  const eligible = productEligibilityPolicy(bds);
  if (!eligible.allowed) throw new Error(eligible.reason);

  if (app.bdsId === bdsId) return app;

  return prisma.$transaction(async (tx) => {
    if (app.bdsPurchaseId) {
      await tx.bdsPurchase.updateMany({
        where: { id: app.bdsPurchaseId, consumedByApplicationId: applicationId },
        data: { consumedByApplicationId: null },
      });
    }
    return tx.application.update({
      where: { id: applicationId },
      data: {
        bdsId,
        bdsPurchaseId: null,
        events: {
          create: { kind: "product_chosen", note: `${bds.number} — ${bds.titleEn}`, actorUserId: userId },
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
      bds: { select: { isMandatory315: true, status: true } },
    },
  });
  if (!app) return null;

  return missingForSubmission({
    bdsId: app.bdsId,
    bds: app.bds,
    bdsPurchaseId: app.bdsPurchaseId,
    factoryId: app.factoryId,
    documents: app.documents,
    organizationComplete: companyGaps(app.organization).length === 0,
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
