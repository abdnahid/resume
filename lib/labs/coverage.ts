/**
 * An office declaring what it can test, and where the rest goes.
 *
 * The server half (D9) of `/labs/coverage`. This is the data-entry path the
 * client asked for: one person per office, three steps, and the two tables that
 * actually matter — `LabCapability` and `LabRouting` — written for them.
 *
 * **A test parameter belongs to no office.** The catalogue is institution-wide;
 * a wing's file is where a test was written down, not a claim about who can run
 * it. The seed had to point capability somewhere so the sampling flow would
 * resolve, and it pointed everything at the head-office section owning each
 * file — which reads exactly like "only head office can do these", and is not
 * true. Every one of those 4,767 rows carries `isPlaceholder`, and this is what
 * replaces them.
 *
 * **The office answers; the laboratory is resolved.** An office says "we can do
 * this test"; which of its benches runs it follows from the parameter's
 * discipline, and at head office from the section its file came from. Asking a
 * data-entry operator to pick between "Organic Chemistry" and "Food &
 * Bacteriology" for each of 4,767 tests would be asking a question they cannot
 * answer and do not need to — while `LabCapability` still has to be per lab,
 * because that is what D64 checks and what a consignment is addressed to.
 */
import { prisma } from "@/lib/prisma";
import type { CapabilityManner } from "@/generated/prisma/client";

/**
 * The head-office section that owns each wing's file.
 *
 * The same table `prisma/seed-labs.ts` keys on, and for the same reason: head
 * office has eight laboratory sections and the parameter's discipline alone
 * cannot choose between four of them. Branch offices have one flat lab per
 * discipline, so they never reach this.
 */
const HEAD_OFFICE_SECTION: Record<string, string> = {
  textile: "lab-pt-textile",
  "chemical-food": "lab-ct-food",
  "chemical-non-food": "lab-ct-organic",
  "physical-civil": "lab-pt-civil",
};

export type ResolvableLab = {
  id: number; slug: string; nameEn: string; discipline: string;
  officeId: number; isActive: boolean;
};

/**
 * Which of an office's laboratories would run this test — or null, said out
 * loud, when the office has no bench of that kind.
 *
 * That null is not an edge case: Cox's Bazar, Cumilla, Faridpur and Mymensingh
 * have a chemistry lab and no physical one, and twelve offices have neither. An
 * office cannot declare capability it has nowhere to put, and the form says so
 * rather than letting somebody tick a box that means nothing.
 */
export function labFor(
  labs: ResolvableLab[],
  officeId: number,
  parameter: { discipline: string; sourceSection: string },
): ResolvableLab | null {
  const own = labs.filter((l) => l.officeId === officeId && l.isActive);
  if (!own.length) return null;

  const section = HEAD_OFFICE_SECTION[parameter.sourceSection];
  const bySection = section ? own.find((l) => l.slug === section) : undefined;
  if (bySection) return bySection;

  return own.find((l) => l.discipline === parameter.discipline) ?? null;
}

/** Every lab, in the shape `labFor()` wants. */
export async function resolvableLabs(): Promise<ResolvableLab[]> {
  return prisma.lab.findMany({
    select: { id: true, slug: true, nameEn: true, discipline: true, officeId: true, isActive: true },
    orderBy: { id: "asc" },
  });
}

// ── Step 1 and 2: what this office deals with ───────────────────────────────

/** The packages this office has taken on, with their product. */
export async function scopeFor(officeId: number) {
  const rows = await prisma.officeSubProductScope.findMany({
    where: { officeId },
    select: {
      subProductId: true,
      subProduct: {
        select: {
          id: true, nameEn: true,
          product: { select: { id: true, serial: true, nameEn: true } },
        },
      },
    },
  });
  return rows.map((r) => r.subProduct);
}

/**
 * Take on, or drop, whole products.
 *
 * Selecting one takes on **every** sub-product beneath it, because that is the
 * default the client asked for — an office that certifies a product normally
 * deals with all its variants, and deselecting the odd one is a smaller job
 * than selecting forty.
 *
 * Dropping a product removes its packages from the scope and **leaves
 * `LabCapability` and `LabRouting` alone**. Those are statements about a bench
 * and about where samples go; "we stopped listing this product" is neither, and
 * silently withdrawing a capability because somebody tidied a working set would
 * be a change nobody asked for.
 */
export async function setProductScope(args: {
  officeId: number;
  add: number[];
  remove: number[];
  employeeId: string | null;
}) {
  if (args.add.length) {
    const subs = await prisma.subProduct.findMany({
      where: { productId: { in: args.add }, foldedAt: null },
      select: { id: true },
    });
    for (let i = 0; i < subs.length; i += 500) {
      await prisma.officeSubProductScope.createMany({
        data: subs.slice(i, i + 500).map((s) => ({
          officeId: args.officeId, subProductId: s.id,
          declaredByEmployeeId: args.employeeId,
        })),
        skipDuplicates: true,
      });
    }
  }
  if (args.remove.length) {
    await prisma.officeSubProductScope.deleteMany({
      where: { officeId: args.officeId, subProduct: { productId: { in: args.remove } } },
    });
  }
}

/** Deselect one variant, or put it back. */
export async function setSubProductScope(args: {
  officeId: number;
  subProductId: number;
  selected: boolean;
  employeeId: string | null;
}) {
  if (args.selected) {
    await prisma.officeSubProductScope.upsert({
      where: {
        officeId_subProductId: { officeId: args.officeId, subProductId: args.subProductId },
      },
      create: {
        officeId: args.officeId, subProductId: args.subProductId,
        declaredByEmployeeId: args.employeeId,
      },
      update: { declaredByEmployeeId: args.employeeId },
    });
  } else {
    await prisma.officeSubProductScope.deleteMany({
      where: { officeId: args.officeId, subProductId: args.subProductId },
    });
  }
}

// ── Step 3: what this office can actually run ───────────────────────────────

/** How an office covers one test, or that it does not. */
export type ParameterState = {
  id: number;
  nameEn: string;
  discipline: string;
  sourceSection: string;
  normalDays: number | null;
  urgentDays: number | null;
  /** `in_house`, `third_party`, or null where this office does not cover it. */
  manner: CapabilityManner | null;
  /** The bench, when the work is in-house here. */
  labId: number | null;
  /** Null when this office has no bench of the right kind — third party only. */
  ownLabId: number | null;
  /** Every other office that has said it can run this test. */
  elsewhere: { officeId: number; manner: CapabilityManner }[];
  /** This office's standing preference for where to send it, if any. */
  preferredOfficeId: number | null;
};

export type CoverageLevel = "full" | "partial" | "none" | "unanswered";

export type PackageState = {
  subProductId: number;
  subProductName: string;
  productId: number;
  productName: string;
  level: CoverageLevel;
  parameters: ParameterState[];
};

/**
 * The state of every package in an office's scope.
 *
 * The level is **derived** from the capability rows rather than stored beside
 * them. A stored level would be a second copy of the same fact and would
 * disagree the first time somebody edited one parameter.
 *
 * `unanswered` and `none` are different: an office that has taken a product on
 * and said nothing about it is not the same as one that has looked and cannot
 * do any of it. The first is work outstanding; the second is a fact — and under
 * the new model (D116) the second is recorded by *silence*, so the two are told
 * apart by whether the package is in scope at all and whether any sibling
 * parameter has been answered.
 */
export async function coverageFor(officeId: number, subProductIds?: number[]) {
  const scope = await prisma.officeSubProductScope.findMany({
    where: { officeId, ...(subProductIds ? { subProductId: { in: subProductIds } } : {}) },
    select: { subProductId: true },
  });
  const ids = scope.map((s) => s.subProductId);
  if (!ids.length) return [] as PackageState[];

  const [subProducts, labs] = await Promise.all([
    prisma.subProduct.findMany({
      where: { id: { in: ids }, foldedAt: null },
      orderBy: [{ productId: "asc" }, { ordinal: "asc" }],
      select: {
        id: true, nameEn: true,
        product: { select: { id: true, nameEn: true, serial: true } },
        parameters: {
          orderBy: [{ ordinal: "asc" }, { id: "asc" }],
          select: {
            id: true, nameEn: true, discipline: true, sourceSection: true,
            normalDays: true, urgentDays: true,
          },
        },
      },
    }),
    resolvableLabs(),
  ]);

  const parameterIds = subProducts.flatMap((s) => s.parameters.map((p) => p.id));
  const [caps, prefs] = await Promise.all([
    prisma.parameterCapability.findMany({
      where: { parameterId: { in: parameterIds }, isActive: true },
      select: { officeId: true, parameterId: true, manner: true, labId: true },
    }),
    prisma.routingPreference.findMany({
      where: { officeId, parameterId: { in: parameterIds } },
      select: { parameterId: true, toOfficeId: true },
    }),
  ]);

  const mine = new Map(caps.filter((c) => c.officeId === officeId).map((c) => [c.parameterId, c]));
  const others = new Map<number, { officeId: number; manner: CapabilityManner }[]>();
  for (const c of caps) {
    if (c.officeId === officeId) continue;
    if (!others.has(c.parameterId)) others.set(c.parameterId, []);
    others.get(c.parameterId)!.push({ officeId: c.officeId, manner: c.manner });
  }
  const prefBy = new Map(prefs.map((p) => [p.parameterId, p.toOfficeId]));

  return subProducts.map<PackageState>((sp) => {
    const parameters = sp.parameters.map<ParameterState>((p) => {
      const own = labFor(labs, officeId, p);
      const held = mine.get(p.id);
      return {
        id: p.id, nameEn: p.nameEn, discipline: p.discipline, sourceSection: p.sourceSection,
        normalDays: p.normalDays, urgentDays: p.urgentDays,
        manner: held?.manner ?? null,
        labId: held?.labId ?? null,
        ownLabId: own?.id ?? null,
        elsewhere: others.get(p.id) ?? [],
        preferredOfficeId: prefBy.get(p.id) ?? null,
      };
    });

    const covered = parameters.filter((p) => p.manner !== null).length;
    const level: CoverageLevel =
      parameters.length === 0
        ? "unanswered"
        : covered === parameters.length
          ? "full"
          : covered > 0
            ? "partial"
            : "unanswered";

    return {
      subProductId: sp.id, subProductName: sp.nameEn,
      productId: sp.product.id, productName: sp.product.nameEn,
      level, parameters,
    };
  });
}

/**
 * Record what this office covers for one package.
 *
 * **Only what it can do.** `inHouse` runs on its own bench, `thirdParty` is
 * sent to an accredited outside laboratory and the result entered by this
 * office's examiner — and everything named in neither is simply *not covered*,
 * which the absence of a row says. That inversion is the client's (D116) and is
 * the whole reason the form is finite: an office never has to answer for a test
 * it does not do, and never has to name where it goes.
 *
 * Written in one transaction, because a package half declared and half not
 * looks answered.
 */
export async function setPackageCoverage(args: {
  officeId: number;
  subProductId: number;
  inHouse: number[];
  thirdParty: number[];
  employeeId: string | null;
  note?: string | null;
}) {
  const [parameters, labs] = await Promise.all([
    prisma.testParameter.findMany({
      where: { subProductId: args.subProductId },
      select: { id: true, nameEn: true, discipline: true, sourceSection: true },
    }),
    resolvableLabs(),
  ]);
  if (!parameters.length) throw new Error("That package has no test parameters.");

  const inHouse = new Set(args.inHouse);
  const thirdParty = new Set(args.thirdParty);
  const both = [...inHouse].filter((id) => thirdParty.has(id));
  if (both.length)
    throw new Error("A test is either run here or sent out — it cannot be both.");

  const rows: { parameterId: number; manner: CapabilityManner; labId: number | null }[] = [];
  const problems: string[] = [];
  const drop: number[] = [];

  for (const p of parameters) {
    if (inHouse.has(p.id)) {
      const own = labFor(labs, args.officeId, p);
      if (!own) {
        problems.push(
          `“${p.nameEn}” is a ${p.discipline} test and this office has no ${p.discipline} laboratory. Mark it as sent out instead.`,
        );
        continue;
      }
      rows.push({ parameterId: p.id, manner: "in_house", labId: own.id });
    } else if (thirdParty.has(p.id)) {
      // No bench is needed, and that is the case this exists for.
      rows.push({ parameterId: p.id, manner: "third_party", labId: null });
    } else {
      drop.push(p.id);
    }
  }
  if (problems.length) throw new Error(problems.join(" "));

  await prisma.$transaction([
    ...rows.map((r) =>
      prisma.parameterCapability.upsert({
        where: { officeId_parameterId: { officeId: args.officeId, parameterId: r.parameterId } },
        create: {
          officeId: args.officeId, parameterId: r.parameterId,
          manner: r.manner, labId: r.labId,
          declaredByEmployeeId: args.employeeId, note: args.note?.trim() || null,
        },
        update: {
          manner: r.manner, labId: r.labId, isActive: true,
          declaredAt: new Date(), declaredByEmployeeId: args.employeeId,
          note: args.note?.trim() || null,
        },
      }),
    ),
    // Withdrawing is a delete, not a flag: absence is what "we do not do this"
    // means now, and a row saying `isActive: false` reads as a claim.
    prisma.parameterCapability.deleteMany({
      where: { officeId: args.officeId, parameterId: { in: drop } },
    }),
    prisma.officeSubProductScope.upsert({
      where: {
        officeId_subProductId: { officeId: args.officeId, subProductId: args.subProductId },
      },
      create: {
        officeId: args.officeId, subProductId: args.subProductId,
        declaredByEmployeeId: args.employeeId,
      },
      update: { declaredByEmployeeId: args.employeeId },
    }),
  ]);

  return { inHouse: rows.filter((r) => r.manner === "in_house").length,
           thirdParty: rows.filter((r) => r.manner === "third_party").length,
           notCovered: drop.length };
}
