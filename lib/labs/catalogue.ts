/**
 * The test-parameter catalogue — the server half (D9).
 *
 * This is Phase G reference data: the 315 mandatory products, the sub-products
 * beneath them, and the parameters that decide what a licence is tested
 * against and what that testing costs. Three wings' files are in it —
 * textile, chemical-food and chemical-non-food — and every wing that files
 * after them merges into the same rows (D62).
 *
 * **A parameter is owned by its sub-product and never shared** (D60). The same
 * name recurs across sub-products carrying a different limit, a different fee
 * or both, so two sub-products naming the same test are two rows with no cell
 * to collide in. Nothing here should tempt anyone to de-duplicate them.
 */
import { prisma } from "@/lib/prisma";
import { priceUrgent, type UrgentFeeSource } from "./urgent-fee";

export type ProductRow = {
  id: number;
  serial: number;
  nameEn: string;
  isMandatory: boolean;
  subProducts: number;
  parameters: number;
  normalFeePoisha: number;
  urgentFeePoisha: number;
  /** The wing sections that have filed parameters for this product. */
  sections: string[];
};

/**
 * Every product with what the catalogue holds for it.
 *
 * One raw query rather than 315 counts: the page shows all of them at once so
 * that "which products has nobody filed parameters for" is answerable by
 * looking, and 315 round trips to db.prisma.io is two and a half minutes.
 */
export async function productRows(): Promise<ProductRow[]> {
  const rows = await prisma.$queryRaw<
    {
      id: number; serial: number; nameEn: string; isMandatory: boolean;
      sub_products: bigint; parameters: bigint;
      normal_fee: bigint | null; urgent_fee: bigint | null;
      sections: string[] | null;
    }[]
  >`
    SELECT p.id, p.serial, p."nameEn", p."isMandatory",
           COUNT(DISTINCT sp.id)                         AS sub_products,
           COUNT(tp.id)                                  AS parameters,
           COALESCE(SUM(tp."feePoisha"), 0)              AS normal_fee,
           COALESCE(SUM(tp."urgentFeePoisha"), 0)        AS urgent_fee,
           ARRAY_REMOVE(ARRAY_AGG(DISTINCT tp."sourceSection"), NULL) AS sections
      FROM "Product" p
      LEFT JOIN "SubProduct"    sp ON sp."productId"    = p.id
      LEFT JOIN "TestParameter" tp ON tp."subProductId" = sp.id
     GROUP BY p.id
     ORDER BY p.serial`;

  return rows.map((r) => ({
    id: r.id, serial: r.serial, nameEn: r.nameEn, isMandatory: r.isMandatory,
    subProducts: Number(r.sub_products),
    parameters: Number(r.parameters),
    normalFeePoisha: Number(r.normal_fee ?? 0),
    urgentFeePoisha: Number(r.urgent_fee ?? 0),
    sections: (r.sections ?? []).slice().sort(),
  }));
}

/** One product, its sub-products, and what each package holds and costs. */
export async function productDetail(productId: number) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true, serial: true, nameEn: true, nameBn: true, genericNames: true,
      isMandatory: true,
      category: { select: { nameEn: true } },
      standards: { select: { bds: { select: { id: true, number: true, titleEn: true } } } },
    },
  });
  if (!product) return null;

  const subProducts = await prisma.subProduct.findMany({
    where: { productId },
    orderBy: [{ ordinal: "asc" }, { id: "asc" }],
    select: {
      id: true, nameEn: true, nameBn: true, standardAsPrinted: true,
      turnaroundNormalDays: true, turnaroundUrgentDays: true,
      packageFees: {
        select: {
          sourceSection: true,
          statedNormalFeePoisha: true, statedUrgentFeePoisha: true,
          summedNormalFeePoisha: true,
          turnaroundNormalDays: true, turnaroundUrgentDays: true,
        },
      },
      parameters: {
        select: {
          feePoisha: true, urgentFeePoisha: true, urgentFeeSource: true,
          discipline: true, sourceSection: true,
        },
      },
    },
  });

  return {
    product,
    subProducts: subProducts.map((s) => ({
      id: s.id, nameEn: s.nameEn, nameBn: s.nameBn,
      standardAsPrinted: s.standardAsPrinted,
      turnaroundNormalDays: s.turnaroundNormalDays,
      turnaroundUrgentDays: s.turnaroundUrgentDays,
      packageFees: s.packageFees,
      parameterCount: s.parameters.length,
      normalFeePoisha: s.parameters.reduce((a, p) => a + p.feePoisha, 0),
      urgentFeePoisha: s.parameters.reduce((a, p) => a + p.urgentFeePoisha, 0),
      sections: [...new Set(s.parameters.map((p) => p.sourceSection))].sort(),
      // The fee an applicant pays is the sum over every lab (D62), so a
      // sub-product tested by two wings shows both disciplines here.
      disciplines: [...new Set(s.parameters.map((p) => p.discipline))].sort(),
      provisionalUrgent: s.parameters.filter(
        (p) => p.urgentFeeSource === "apportioned" || p.urgentFeeSource === "doubled_assumed",
      ).length,
    })),
  };
}

/** One package, in full: its parameters, their limits and their prices. */
export async function subProductDetail(subProductId: number) {
  const sp = await prisma.subProduct.findUnique({
    where: { id: subProductId },
    select: {
      id: true, nameEn: true, nameBn: true, standardAsPrinted: true,
      turnaroundNormalDays: true, turnaroundUrgentDays: true,
      product: { select: { id: true, serial: true, nameEn: true } },
      bds: { select: { number: true, titleEn: true } },
      packageFees: {
        orderBy: { sourceSection: "asc" },
        select: {
          sourceSection: true,
          statedNormalFeePoisha: true, statedUrgentFeePoisha: true,
          summedNormalFeePoisha: true,
          turnaroundNormalDays: true, turnaroundUrgentDays: true,
        },
      },
      parameters: {
        orderBy: [{ ordinal: "asc" }, { id: "asc" }],
        select: {
          id: true, nameEn: true, slug: true,
          feePoisha: true, urgentFeePoisha: true, urgentFeeSource: true,
          discipline: true, sourceSection: true,
          limitText: true, limitKind: true,
          method: { select: { id: true, designation: true } },
          subParameters: {
            orderBy: { ordinal: "asc" },
            select: { id: true, label: true, limitText: true, limitKind: true },
          },
          _count: { select: { capabilities: true } },
        },
      },
    },
  });
  return sp;
}

/**
 * Change one parameter.
 *
 * **A hand-entered urgent fee is stamped `manual` and is never recomputed
 * over** (D99). That is the whole point of storing where a figure came from:
 * the recompute re-prices packages from what the wing published, and a
 * correction somebody made deliberately must survive it. Changing the *normal*
 * fee alone leaves the urgent one to the recompute, because the two are not
 * independent — the apportionment divides by the normal total.
 */
export async function updateParameter(args: {
  parameterId: number;
  nameEn?: string;
  feePoisha?: number;
  urgentFeePoisha?: number;
  limitText?: string | null;
  methodId?: number | null;
}) {
  const existing = await prisma.testParameter.findUnique({
    where: { id: args.parameterId },
    select: { id: true, urgentFeePoisha: true, subParameters: { select: { id: true }, take: 1 } },
  });
  if (!existing) throw new Error("No such parameter.");

  if (args.feePoisha !== undefined && (!Number.isInteger(args.feePoisha) || args.feePoisha < 0))
    throw new Error("A fee is a whole number of poisha and cannot be negative.");
  if (args.urgentFeePoisha !== undefined && (!Number.isInteger(args.urgentFeePoisha) || args.urgentFeePoisha < 0))
    throw new Error("A fee is a whole number of poisha and cannot be negative.");
  // The limit sits at the leaf (D61): on the parameter when it has no
  // sub-parameters, on each sub-parameter when it has them. Writing one here
  // over a parameter that has children would put the same fact in two places
  // and leave nothing to say which is current.
  if (args.limitText !== undefined && existing.subParameters.length)
    throw new Error(
      "This parameter has sub-parameters, so the limit belongs to each of them rather than here.",
    );

  const data: Record<string, unknown> = {};
  if (args.nameEn !== undefined) {
    const n = args.nameEn.trim();
    if (!n) throw new Error("A parameter needs a name.");
    data.nameEn = n;
    data.slug = n.toLowerCase().replace(/\s+/g, " ").trim();
  }
  if (args.feePoisha !== undefined) data.feePoisha = args.feePoisha;
  if (args.urgentFeePoisha !== undefined && args.urgentFeePoisha !== existing.urgentFeePoisha) {
    data.urgentFeePoisha = args.urgentFeePoisha;
    data.urgentFeeSource = "manual" satisfies UrgentFeeSource;
  }
  if (args.limitText !== undefined) data.limitText = args.limitText?.trim() || null;
  if (args.methodId !== undefined) data.methodId = args.methodId;

  return prisma.testParameter.update({ where: { id: args.parameterId }, data });
}

/**
 * Change a package's turnaround, and re-price its urgent fees.
 *
 * The two cannot be separated: whether an urgent service exists at all is
 * decided by the turnaround being shorter (D99), so editing the days without
 * re-pricing would leave a package charging a surcharge for a service it no
 * longer offers — or offering one for free.
 */
export async function updateSubProduct(args: {
  subProductId: number;
  turnaroundNormalDays?: number | null;
  turnaroundUrgentDays?: number | null;
  standardAsPrinted?: string | null;
}) {
  const data: Record<string, unknown> = {};
  if (args.turnaroundNormalDays !== undefined) data.turnaroundNormalDays = args.turnaroundNormalDays;
  if (args.turnaroundUrgentDays !== undefined) data.turnaroundUrgentDays = args.turnaroundUrgentDays;
  if (args.standardAsPrinted !== undefined)
    data.standardAsPrinted = args.standardAsPrinted?.trim() || null;

  await prisma.subProduct.update({ where: { id: args.subProductId }, data });

  if (args.turnaroundNormalDays !== undefined || args.turnaroundUrgentDays !== undefined) {
    await prisma.subProductPackageFee.updateMany({
      where: { subProductId: args.subProductId },
      data: {
        ...(args.turnaroundNormalDays !== undefined
          ? { turnaroundNormalDays: args.turnaroundNormalDays }
          : {}),
        ...(args.turnaroundUrgentDays !== undefined
          ? { turnaroundUrgentDays: args.turnaroundUrgentDays }
          : {}),
      },
    });
    await repriceSubProduct(args.subProductId);
  }
}

/**
 * Re-price one package's urgent fees from what its wing published.
 *
 * The screen-sized counterpart of `npm run fees:urgent`, which does the whole
 * catalogue. Same function decides the price in both, so a fee corrected on
 * screen and one corrected by the script cannot come out differently.
 */
export async function repriceSubProduct(subProductId: number) {
  const packages = await prisma.subProductPackageFee.findMany({
    where: { subProductId },
    select: {
      sourceSection: true, statedUrgentFeePoisha: true,
      turnaroundNormalDays: true, turnaroundUrgentDays: true,
    },
  });

  for (const pkg of packages) {
    const rows = await prisma.testParameter.findMany({
      where: { subProductId, sourceSection: pkg.sourceSection },
      orderBy: [{ ordinal: "asc" }, { id: "asc" }],
      select: { id: true, feePoisha: true, urgentFeePoisha: true, urgentFeeSource: true },
    });
    const manual = rows.filter((r) => r.urgentFeeSource === "manual");
    const auto = rows.filter((r) => r.urgentFeeSource !== "manual");
    if (!auto.length) continue;

    let stated = pkg.statedUrgentFeePoisha;
    if (stated !== null && manual.length) {
      stated -= manual.reduce((a, r) => a + r.urgentFeePoisha, 0);
      if (stated <= 0) stated = null;
    }

    const priced = priceUrgent({
      normalFees: auto.map((r) => r.feePoisha),
      statedUrgentTotal: stated,
      normalDays: pkg.turnaroundNormalDays,
      urgentDays: pkg.turnaroundUrgentDays,
    });

    await Promise.all(
      auto
        .map((r, i) => ({ r, fee: priced.urgentFees[i] }))
        .filter(({ r, fee }) => fee !== r.urgentFeePoisha || priced.source !== r.urgentFeeSource)
        .map(({ r, fee }) =>
          prisma.testParameter.update({
            where: { id: r.id },
            data: { urgentFeePoisha: fee, urgentFeeSource: priced.source },
          }),
        ),
    );
  }
}

/** The method list, for the picker. A method is a document, shared (D60). */
export async function methodOptions() {
  return prisma.testMethod.findMany({
    orderBy: { designation: "asc" },
    select: { id: true, designation: true },
  });
}
