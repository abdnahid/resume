/**
 * The articles a CM licence would cover — the server half (D9).
 *
 * A licence is granted for a product made at a factory, but what reaches a shelf
 * is a SKU: a brand, a flavour, a size, a pack. The spec lists **inclusion** of a
 * new brand/type/size/flavour/grade as its own wing service, so these are rows
 * that a licence gains over its life, not a paragraph written once.
 */
import { prisma } from "@/lib/prisma";
import { canEditTarget } from "./states";
import { artworkTarget } from "./policy";
import { assertEditable, editScopeFor } from "./shortfall";
import { validateSku, validateLabelImage, type SkuInput } from "./policy";

/** The size vocabulary the form offers — 12 types, 43 units. */
export async function sizeVocabulary() {
  return prisma.sizeType.findMany({
    include: { units: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });
}

const SKU_INCLUDE = {
  sizeType: { select: { id: true, slug: true, nameEn: true, nameBn: true, kind: true } },
  sizeUnit: { select: { id: true, code: true, nameEn: true } },
};

/**
 * Every article on the file, across all its sub-products.
 *
 * A SKU now hangs off `ApplicationSubProduct` rather than the application (D67)
 * — the applicant picks A1 and A3 and then names the variants under each, so a
 * variant only means something beside the sub-product it varies.
 */
export async function skusFor(applicationId: number) {
  return prisma.applicationSku.findMany({
    where: { applicationSubProduct: { applicationId } },
    include: SKU_INCLUDE,
    orderBy: [{ applicationSubProductId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });
}

/** The articles under one sub-product. */
export async function skusForSubProduct(applicationSubProductId: number) {
  return prisma.applicationSku.findMany({
    where: { applicationSubProductId },
    include: SKU_INCLUDE,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

/**
 * The sub-product must be on the application the caller named. Without this a
 * request could hang an article off another company's file by guessing an id.
 */
async function subProductOf(applicationId: number, applicationSubProductId: number) {
  const row = await prisma.applicationSubProduct.findUnique({
    where: { id: applicationSubProductId },
    select: { id: true, applicationId: true },
  });
  if (!row || row.applicationId !== applicationId)
    throw new Error("That sub-product is not on this application.");
  return row;
}

/**
 * The checks every write goes through.
 *
 * Editability, standing on the file, and that the unit belongs to the size type
 * — the last is not cosmetic: without it a request could pair "Weight" with
 * "litre" and store a size nothing can read.
 */
async function guard(applicationId: number, userId: string) {
  const app = await standing(applicationId, userId);
  // A correction round can reopen the articles alone (D81), so this asks about
  // the target rather than about the state.
  await assertEditable(applicationId, "skus");
  return app;
}

/** Membership only — who may act on the file, saying nothing about what is open. */
async function standing(applicationId: number, userId: string) {
  const app = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId: app.organizationId } },
  });
  if (!membership || membership.role === "viewer") {
    throw new Error("You do not have permission to change this application.");
  }
  return app;
}

/**
 * The label columns, or nothing.
 *
 * `undefined` for `labelImageName` means "leave whatever is there" — an edit
 * that does not touch the label must not clear it. An explicit `null` clears.
 */
function labelFields(input: SkuInput) {
  if (input.labelImageName === undefined) return {};
  const problem = validateLabelImage(input);
  if (problem) throw new Error(problem.message);
  return input.labelImageName === null
    ? { labelImageName: null, labelImageSizeBytes: null, labelImageMime: null }
    : {
        labelImageName: input.labelImageName,
        labelImageSizeBytes: input.labelImageSizeBytes ?? null,
        labelImageMime: input.labelImageMime ?? null,
      };
}

async function resolveSize(input: SkuInput) {
  const sizeType = await prisma.sizeType.findUnique({
    where: { id: input.sizeTypeId },
    include: { units: { select: { id: true } } },
  });
  if (!sizeType) throw new Error("Choose how this size is measured.");

  // The unit must belong to the type the applicant chose. Trusting the pair as
  // sent would let "Weight / litre" through, and every screen downstream would
  // then render a size that means nothing.
  if (!sizeType.units.some((u) => u.id === input.sizeUnitId)) {
    throw new Error(`That unit does not belong to ${sizeType.nameEn}.`);
  }

  const problems = validateSku(input, sizeType);
  if (problems.length > 0) throw new Error(problems.map((p) => p.message).join(" "));

  const numeric = sizeType.kind === "numeric";
  const raw = typeof input.sizeValue === "string" ? Number(input.sizeValue) : input.sizeValue;
  const per =
    typeof input.unitsPerPack === "string" ? Number(input.unitsPerPack) : input.unitsPerPack;

  return {
    sizeTypeId: sizeType.id,
    sizeUnitId: input.sizeUnitId,
    sizeValue: numeric && raw !== null && raw !== undefined ? String(raw) : null,
    unitsPerPack: per === null || per === undefined || input.unitsPerPack === "" ? null : per,
  };
}

const text = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

export async function addSku(
  applicationId: number,
  applicationSubProductId: number,
  input: SkuInput,
  userId: string,
) {
  await guard(applicationId, userId);
  await subProductOf(applicationId, applicationSubProductId);
  const size = await resolveSize(input);

  const last = await prisma.applicationSku.findFirst({
    where: { applicationSubProductId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await prisma.applicationSku.create({
    data: {
      applicationSubProductId,
      brandName: input.brandName.trim(),
      variant: text(input.variant),
      packaging: text(input.packaging),
      grade: text(input.grade),
      sortOrder: (last?.sortOrder ?? -1) + 1,
      ...size,
      ...labelFields(input),
    },
    include: SKU_INCLUDE,
  });

  await prisma.applicationEvent.create({
    data: {
      applicationId,
      kind: "sku_added",
      note: `${created.brandName}${created.variant ? ` — ${created.variant}` : ""}`,
      actorUserId: userId,
    },
  });

  return created;
}

export async function updateSku(
  applicationId: number,
  skuId: number,
  input: SkuInput,
  userId: string,
) {
  await standing(applicationId, userId);

  const existing = await prisma.applicationSku.findUnique({
    where: { id: skuId },
    include: { applicationSubProduct: { select: { applicationId: true } } },
  });
  if (!existing || existing.applicationSubProduct.applicationId !== applicationId) {
    throw new Error("That variant is not on this application.");
  }

  /**
   * Artwork is marked per variant (D53, D81), so "replace the label on the 2 L
   * bottle" is a narrower permission than "the articles are wrong".
   *
   * **An artwork-only permission writes only the artwork**, and the server is
   * what enforces that rather than the form: the edit form posts the whole
   * variant, so comparing what changed would let a resubmitted brand name
   * through on a technicality. Everything but the label columns is simply not
   * written.
   */
  const scope = await editScopeFor(applicationId);
  if (!canEditTarget(scope, "skus")) {
    if (!canEditTarget(scope, artworkTarget(skuId))) {
      // Reuse the one gate so the message is the same everywhere.
      await assertEditable(applicationId, "skus");
    }
    return prisma.applicationSku.update({
      where: { id: skuId },
      data: labelFields(input),
      include: SKU_INCLUDE,
    });
  }

  const size = await resolveSize(input);

  return prisma.applicationSku.update({
    where: { id: skuId },
    data: {
      brandName: input.brandName.trim(),
      variant: text(input.variant),
      packaging: text(input.packaging),
      grade: text(input.grade),
      ...size,
      ...labelFields(input),
    },
    include: SKU_INCLUDE,
  });
}

export async function removeSku(applicationId: number, skuId: number, userId: string) {
  await guard(applicationId, userId);

  const existing = await prisma.applicationSku.findUnique({
    where: { id: skuId },
    include: { applicationSubProduct: { select: { applicationId: true } } },
  });
  if (!existing || existing.applicationSubProduct.applicationId !== applicationId) {
    throw new Error("That variant is not on this application.");
  }

  // Specimens are sealed against a variant, so removing one after sampling
  // would leave jars in the applicant's custody that nothing can account for.
  // The state guard above already stops an applicant reaching this, but the
  // registration is the thing that must not be orphaned, so it is checked here
  // too rather than trusted to the state machine.
  const sealed = await prisma.sampleRegistration.count({ where: { applicationSkuId: skuId } });
  if (sealed > 0) {
    throw new Error("Samples have already been sealed for this variant.");
  }

  await prisma.applicationSku.delete({ where: { id: skuId } });
  await prisma.applicationEvent.create({
    data: {
      applicationId,
      kind: "sku_removed",
      note: `${existing.brandName}${existing.variant ? ` — ${existing.variant}` : ""}`,
      actorUserId: userId,
    },
  });
}
