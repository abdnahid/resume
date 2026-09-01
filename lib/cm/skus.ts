/**
 * The articles a CM licence would cover — the server half (D9).
 *
 * A licence is granted for a product made at a factory, but what reaches a shelf
 * is a SKU: a brand, a flavour, a size, a pack. The spec lists **inclusion** of a
 * new brand/type/size/flavour/grade as its own wing service, so these are rows
 * that a licence gains over its life, not a paragraph written once.
 */
import { prisma } from "@/lib/prisma";
import { validateSku, type SkuInput } from "./policy";

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

export async function skusFor(applicationId: number) {
  return prisma.applicationSku.findMany({
    where: { applicationId },
    include: SKU_INCLUDE,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

/**
 * The checks every write goes through.
 *
 * Editability, standing on the file, and that the unit belongs to the size type
 * — the last is not cosmetic: without it a request could pair "Weight" with
 * "litre" and store a size nothing can read.
 */
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

export async function addSku(applicationId: number, input: SkuInput, userId: string) {
  await guard(applicationId, userId);
  const size = await resolveSize(input);

  const last = await prisma.applicationSku.findFirst({
    where: { applicationId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await prisma.applicationSku.create({
    data: {
      applicationId,
      brandName: input.brandName.trim(),
      variant: text(input.variant),
      packaging: text(input.packaging),
      grade: text(input.grade),
      sortOrder: (last?.sortOrder ?? -1) + 1,
      ...size,
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
  await guard(applicationId, userId);

  const existing = await prisma.applicationSku.findUnique({ where: { id: skuId } });
  if (!existing || existing.applicationId !== applicationId) {
    throw new Error("That variant is not on this application.");
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
    },
    include: SKU_INCLUDE,
  });
}

export async function removeSku(applicationId: number, skuId: number, userId: string) {
  await guard(applicationId, userId);

  const existing = await prisma.applicationSku.findUnique({ where: { id: skuId } });
  if (!existing || existing.applicationId !== applicationId) {
    throw new Error("That variant is not on this application.");
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
