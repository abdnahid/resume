/**
 * The sub-products a licence is applied for — the server half (D9, D67).
 *
 * The applicant picks the product from the mandatory 315, then the sub-products
 * beneath it, and names the variants under each. Picking the sub-product is
 * what makes a test plan and a fee resolvable **before** inspection rather than
 * only after it: the fee is the sum of the parameter fees of the sub-products
 * chosen, across every lab that runs them.
 *
 * The FDO may add rows at inspection — he finds A2 on the factory floor, or a
 * third variant of A1 the applicant forgot. `declaredBy` keeps the two apart,
 * because "did they under-declare, or did we find more" is asked in disputes
 * and an overwrite cannot answer it.
 */
import { prisma } from "@/lib/prisma";

/** The sub-products offered for a product, with what each would cost to test. */
export async function choicesFor(productId: number) {
  const rows = await prisma.subProduct.findMany({
    where: { productId },
    orderBy: [{ ordinal: "asc" }, { id: "asc" }],
    select: {
      id: true,
      nameEn: true,
      nameBn: true,
      standardAsPrinted: true,
      turnaroundNormalDays: true,
      turnaroundUrgentDays: true,
      parameters: { select: { feePoisha: true, discipline: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    nameEn: r.nameEn,
    nameBn: r.nameBn,
    standardAsPrinted: r.standardAsPrinted,
    turnaroundNormalDays: r.turnaroundNormalDays,
    turnaroundUrgentDays: r.turnaroundUrgentDays,
    parameterCount: r.parameters.length,
    // The grand total, summed across labs. A wing's file carries only its own
    // subtotal (D62), so this is the first place the whole figure exists.
    testFeePoisha: r.parameters.reduce((a, p) => a + p.feePoisha, 0),
    byDiscipline: {
      physical: r.parameters.filter((p) => p.discipline === "physical").reduce((a, p) => a + p.feePoisha, 0),
      chemical: r.parameters.filter((p) => p.discipline === "chemical").reduce((a, p) => a + p.feePoisha, 0),
    },
  }));
}

/** Everything chosen on this file, with its variants. */
export async function selectedFor(applicationId: number) {
  return prisma.applicationSubProduct.findMany({
    where: { applicationId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      subProduct: {
        select: { id: true, nameEn: true, nameBn: true, standardAsPrinted: true },
      },
      _count: { select: { skus: true } },
    },
  });
}

/**
 * Editability and standing, the same gate the SKU service uses.
 *
 * `allowFdo` opens it after submission for the inspecting officer: the whole
 * point of his amendment is that it happens once the file has left the
 * applicant's hands.
 */
async function guard(applicationId: number, userId: string, allowFdo = false) {
  const app = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
  const editable = app.state === "draft" || app.state === "pending_app_fee";
  if (!editable && !allowFdo) throw new Error("This application can no longer be edited.");

  if (!allowFdo) {
    const membership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId: app.organizationId } },
    });
    if (!membership || membership.role === "viewer")
      throw new Error("You do not have permission to change this application.");
  }
  return app;
}

/**
 * Put a sub-product on the file.
 *
 * It must belong to the product the application names — otherwise a request
 * could attach a sub-product of some other article and the test plan would
 * resolve against parameters nobody applied for.
 */
export async function addSubProduct(args: {
  applicationId: number;
  subProductId: number;
  userId: string;
  declaredBy?: "applicant" | "fdo";
  employeeId?: string;
}) {
  const byFdo = args.declaredBy === "fdo";
  const app = await guard(args.applicationId, args.userId, byFdo);

  const sp = await prisma.subProduct.findUnique({
    where: { id: args.subProductId },
    select: { id: true, productId: true, nameEn: true },
  });
  if (!sp) throw new Error("No such sub-product.");
  if (!app.productId || sp.productId !== app.productId)
    throw new Error("That sub-product does not belong to the product on this application.");

  const last = await prisma.applicationSubProduct.findFirst({
    where: { applicationId: args.applicationId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const row = await prisma.applicationSubProduct.upsert({
    where: {
      applicationId_subProductId: {
        applicationId: args.applicationId,
        subProductId: args.subProductId,
      },
    },
    create: {
      applicationId: args.applicationId,
      subProductId: args.subProductId,
      declaredBy: byFdo ? "fdo" : "applicant",
      declaredByEmployeeId: byFdo ? (args.employeeId ?? null) : null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
    update: {},
    include: { subProduct: { select: { nameEn: true } } },
  });

  await prisma.applicationEvent.create({
    data: {
      applicationId: args.applicationId,
      kind: byFdo ? "sub_product_found" : "sub_product_added",
      note: sp.nameEn,
      actorUserId: args.userId,
    },
  });
  return row;
}

/**
 * Take one off. Refused once specimens exist against it — by then the FDO has
 * sealed jars for it and the boxes are in the applicant's custody, so removing
 * the row would orphan physical samples nobody could account for.
 */
export async function removeSubProduct(args: {
  applicationId: number;
  applicationSubProductId: number;
  userId: string;
  isFdo?: boolean;
}) {
  await guard(args.applicationId, args.userId, args.isFdo ?? false);

  const row = await prisma.applicationSubProduct.findUnique({
    where: { id: args.applicationSubProductId },
    select: {
      applicationId: true,
      subProduct: { select: { nameEn: true } },
      _count: { select: { registry: true } },
    },
  });
  if (!row || row.applicationId !== args.applicationId)
    throw new Error("That sub-product is not on this application.");
  if (row._count.registry > 0)
    throw new Error("Samples have already been sealed for this sub-product.");

  await prisma.applicationSubProduct.delete({ where: { id: args.applicationSubProductId } });
  await prisma.applicationEvent.create({
    data: {
      applicationId: args.applicationId,
      kind: "sub_product_removed",
      note: row.subProduct.nameEn,
      actorUserId: args.userId,
    },
  });
}

/**
 * The test fee for the file as it currently stands, in poisha.
 *
 * Provisional while the applicant is still editing and final once the FDO has
 * amended it — the same function either way, so the two figures can never be
 * computed differently.
 */
export async function testFeeFor(applicationId: number) {
  const rows = await prisma.applicationSubProduct.findMany({
    where: { applicationId },
    select: {
      subProduct: {
        select: { nameEn: true, parameters: { select: { feePoisha: true, discipline: true } } },
      },
    },
  });
  const lines = rows.map((r) => ({
    subProduct: r.subProduct.nameEn,
    poisha: r.subProduct.parameters.reduce((a, p) => a + p.feePoisha, 0),
  }));
  return { lines, totalPoisha: lines.reduce((a, l) => a + l.poisha, 0) };
}
