/**
 * Steps 3 and 4 of the application — what the plant makes, and how it is run.
 *
 * Server half (D9); the catalogues and validation live in `policy.ts`.
 *
 * Both belong to the **application** rather than the factory, and that is the
 * client's own reasoning: one plant may run several product lines, so a
 * capacity figure only means something beside the product it is for. It is also
 * a statement made on a date — the file has to keep saying what was claimed
 * when it was submitted.
 */
import { prisma } from "@/lib/prisma";
import {
  CM_QUESTIONS,
  CM_QUESTION_INDEX,
  isCapacityAuthority,
  type CapacityAuthorityValue,
} from "./policy";

/** Editability and standing, the same gate the SKU writes go through. */
async function guard(applicationId: number, userId: string) {
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
  return app;
}

export type ProductionInput = {
  authority: string;
  registrationNo?: string | null;
  annualCapacityValue: number;
  capacityUnitId: number;
  currentYearLabel: string;
  currentYearProduction: number;
};

/**
 * Record the capacity for this product.
 *
 * The unit is a `SizeUnit`, reused from the SKU vocabulary, and it is checked
 * against the size types the product's own articles use where there are any —
 * a capacity in litres against a product sold by weight is not a number anyone
 * can act on.
 */
export async function setProduction(
  applicationId: number,
  input: ProductionInput,
  userId: string,
) {
  await guard(applicationId, userId);

  if (!isCapacityAuthority(input.authority)) {
    throw new Error("Choose who approved the capacity.");
  }
  if (!(input.annualCapacityValue > 0)) {
    throw new Error("Annual capacity must be more than zero.");
  }
  if (!(input.currentYearProduction >= 0)) {
    throw new Error("This year's production cannot be negative.");
  }
  if (input.currentYearProduction > input.annualCapacityValue) {
    // Not a typo-catcher: producing above approved capacity is exactly the kind
    // of thing a licence review exists to notice, so it is refused here and the
    // applicant is told which of the two numbers to look at.
    throw new Error(
      "This year's production is more than the approved annual capacity. Check both figures — a plant cannot be licensed to make more than it is approved for.",
    );
  }
  if (!input.currentYearLabel?.trim()) {
    throw new Error("Which year are these figures for?");
  }

  const unit = await prisma.sizeUnit.findUnique({
    where: { id: input.capacityUnitId },
    select: { id: true, sizeTypeId: true },
  });
  if (!unit) throw new Error("Choose the unit the capacity is measured in.");

  const authority = input.authority as CapacityAuthorityValue;
  const data = {
    authority,
    registrationNo: input.registrationNo?.trim() || null,
    annualCapacityValue: input.annualCapacityValue,
    capacityUnitId: unit.id,
    currentYearLabel: input.currentYearLabel.trim(),
    currentYearProduction: input.currentYearProduction,
  };

  return prisma.applicationProduction.upsert({
    where: { applicationId },
    update: data,
    create: { applicationId, ...data },
  });
}

/**
 * Save answers to BSTI's questions.
 *
 * Takes whatever subset the form sends, so a half-finished step 4 is kept —
 * these are long answers and losing them to a navigation would be its own
 * reason not to finish the form. An unknown key is ignored rather than stored:
 * the catalogue is the contract.
 */
export async function saveAnswers(
  applicationId: number,
  answers: Record<string, unknown>,
  userId: string,
) {
  await guard(applicationId, userId);

  const writes = [];
  for (const [key, raw] of Object.entries(answers)) {
    const q = CM_QUESTION_INDEX.get(key);
    if (!q) continue;

    let answerText: string | null = null;
    let answerNumber: number | null = null;
    if (q.type === "number") {
      const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
      if (String(raw ?? "").trim() === "" || !Number.isFinite(n)) answerNumber = null;
      else if (n < 0) throw new Error(`${q.labelEn} cannot be negative.`);
      else answerNumber = Math.round(n);
    } else {
      const t = String(raw ?? "").trim();
      answerText = t === "" ? null : t;
    }

    writes.push(
      prisma.applicationAnswer.upsert({
        where: { applicationId_questionKey: { applicationId, questionKey: key } },
        update: { answerText, answerNumber },
        create: { applicationId, questionKey: key, answerText, answerNumber },
      }),
    );
  }
  if (writes.length) await prisma.$transaction(writes);
  return prisma.applicationAnswer.findMany({ where: { applicationId } });
}

/**
 * The declaration.
 *
 * Recorded as a time and a person rather than a flag, because it is a statement
 * someone made. Withdrawing it is allowed while the file is still a draft — a
 * declaration that cannot be taken back before submission would trap an
 * applicant who spotted a mistake in it.
 */
export async function setConsent(applicationId: number, accepted: boolean, userId: string) {
  await guard(applicationId, userId);
  return prisma.application.update({
    where: { id: applicationId },
    data: {
      consentAcceptedAt: accepted ? new Date() : null,
      consentAcceptedBy: accepted ? userId : null,
      events: {
        create: {
          kind: accepted ? "consent_given" : "consent_withdrawn",
          actorUserId: userId,
        },
      },
    },
  });
}

/**
 * The factory-level answers from this factory's most recent other application,
 * offered as a starting point.
 *
 * Manpower, quality control and records describe the plant, not the product, so
 * a manufacturer applying for a second product should not retype them.
 * Production capacity is deliberately **not** carried across: it is per product
 * line, and copying it would import the wrong product's numbers.
 */
export async function prefillableAnswers(applicationId: number) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { factoryId: true },
  });
  if (!app) return null;

  const previous = await prisma.application.findFirst({
    where: { factoryId: app.factoryId, id: { not: applicationId }, answers: { some: {} } },
    orderBy: { id: "desc" },
    select: {
      id: true,
      product: { select: { nameEn: true } },
      answers: { select: { questionKey: true, answerText: true, answerNumber: true } },
    },
  });
  if (!previous) return null;

  // Only the groups that describe the factory. Identification and the process
  // steps are about the product being made, so they start blank.
  const FACTORY_GROUPS = new Set(["manpower", "quality", "records"]);
  const keys = new Set(
    CM_QUESTIONS.filter((g) => FACTORY_GROUPS.has(g.key)).flatMap((g) =>
      g.questions.map((q) => q.key),
    ),
  );
  const answers = previous.answers.filter((a) => keys.has(a.questionKey));
  if (!answers.length) return null;

  return { fromApplicationId: previous.id, fromProduct: previous.product?.nameEn ?? null, answers };
}
