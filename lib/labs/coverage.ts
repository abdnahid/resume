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

/** How much of a package an office can do. Derived, never stored. */
export type CoverageLevel = "full" | "partial" | "none" | "unanswered";

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

export type ParameterState = {
  id: number;
  nameEn: string;
  discipline: string;
  sourceSection: string;
  /** True when this office's own bench holds it, and not as a stand-in. */
  hereCapable: boolean;
  /** Where it currently goes, and whether that is a real decision. */
  destinationLabId: number | null;
  destinationOfficeId: number | null;
  destinationIsPlaceholder: boolean;
  /** True when the destination has not declared it can run this. */
  destinationPending: boolean;
  /** Null when this office has no bench of the right kind at all. */
  ownLabId: number | null;
};

export type PackageState = {
  subProductId: number;
  subProductName: string;
  productId: number;
  productName: string;
  level: CoverageLevel;
  parameters: ParameterState[];
};

/**
 * The state of every package in an office's scope — what it can do, what it
 * sends away, and what nobody has answered yet.
 *
 * The level is **derived** from the capability rows rather than stored beside
 * them. A stored level would be a second copy of the same fact, and the two
 * would disagree the first time somebody edited one parameter on the map.
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
          select: { id: true, nameEn: true, discipline: true, sourceSection: true },
        },
      },
    }),
    resolvableLabs(),
  ]);

  const parameterIds = subProducts.flatMap((s) => s.parameters.map((p) => p.id));
  const [caps, routes] = await Promise.all([
    prisma.labCapability.findMany({
      where: { parameterId: { in: parameterIds }, isActive: true },
      select: { labId: true, parameterId: true, isPlaceholder: true },
    }),
    prisma.labRouting.findMany({
      where: { officeId, parameterId: { in: parameterIds } },
      select: { parameterId: true, labId: true, isPlaceholder: true },
    }),
  ]);

  const labById = new Map(labs.map((l) => [l.id, l]));
  // Real capability only: a stand-in is not somebody saying they can run it.
  const realCap = new Set(
    caps.filter((c) => !c.isPlaceholder).map((c) => `${c.labId}:${c.parameterId}`),
  );
  const anyCap = new Set(caps.map((c) => `${c.labId}:${c.parameterId}`));
  const routeBy = new Map(routes.map((r) => [r.parameterId, r]));

  return subProducts.map<PackageState>((sp) => {
    const parameters = sp.parameters.map<ParameterState>((p) => {
      const own = labFor(labs, officeId, p);
      const route = routeBy.get(p.id);
      const destLab = route ? labById.get(route.labId) ?? null : null;
      return {
        id: p.id, nameEn: p.nameEn, discipline: p.discipline, sourceSection: p.sourceSection,
        hereCapable: own ? realCap.has(`${own.id}:${p.id}`) : false,
        destinationLabId: destLab?.id ?? null,
        destinationOfficeId: destLab?.officeId ?? null,
        destinationIsPlaceholder: route?.isPlaceholder ?? true,
        destinationPending: destLab ? !anyCap.has(`${destLab.id}:${p.id}`) : false,
        ownLabId: own?.id ?? null,
      };
    });

    const here = parameters.filter((p) => p.hereCapable).length;
    const level: CoverageLevel =
      parameters.length === 0
        ? "unanswered"
        : here === parameters.length
          ? "full"
          : here > 0
            ? "partial"
            : parameters.every((p) => !p.destinationIsPlaceholder)
              ? "none"
              : "unanswered";

    return {
      subProductId: sp.id, subProductName: sp.nameEn,
      productId: sp.product.id, productName: sp.product.nameEn,
      level, parameters,
    };
  });
}

/**
 * Record an office's answer for one package.
 *
 * `here` is the parameters this office runs itself; everything else needs a
 * destination office. Both halves are written in one transaction, because a
 * package that is half declared and half routed is worse than one nobody has
 * touched — it looks answered.
 *
 * **A destination that has not declared the capability is allowed, and
 * reported.** The alternative is a deadlock: Barisal knows perfectly well that
 * Khulna runs a test, but cannot say so until somebody at Khulna has filled in
 * their own form, and Khulna is in the same position about Barisal. So the row
 * is written and named back to the caller as pending. Nothing is lost by
 * this — `resolveDestinations()` still refuses to follow such a row, by name,
 * long before a sample moves (D64).
 */
export async function setPackageCoverage(args: {
  officeId: number;
  subProductId: number;
  /** Parameter ids this office runs on its own bench. */
  here: number[];
  /** Parameter id → the office it is sent to, for everything else. */
  sendTo: Record<number, number>;
  employeeId: string | null;
}) {
  const [parameters, labs] = await Promise.all([
    prisma.testParameter.findMany({
      where: { subProductId: args.subProductId },
      select: { id: true, nameEn: true, discipline: true, sourceSection: true },
    }),
    resolvableLabs(),
  ]);
  if (!parameters.length) throw new Error("That package has no test parameters.");

  const hereSet = new Set(args.here);
  const capOn: { labId: number; parameterId: number }[] = [];
  const capOff: { labId: number; parameterId: number }[] = [];
  const routes: { parameterId: number; labId: number }[] = [];
  const problems: string[] = [];

  for (const p of parameters) {
    const own = labFor(labs, args.officeId, p);

    if (hereSet.has(p.id)) {
      if (!own) {
        problems.push(
          `“${p.nameEn}” is a ${p.discipline} test and this office has no ${p.discipline} laboratory, so it cannot be run here.`,
        );
        continue;
      }
      capOn.push({ labId: own.id, parameterId: p.id });
      routes.push({ parameterId: p.id, labId: own.id });
      continue;
    }

    // Not run here: withdraw any capability this office had claimed, so that
    // changing the answer from "we do this" to "we send it away" actually
    // changes both halves rather than leaving a stale claim behind.
    if (own) capOff.push({ labId: own.id, parameterId: p.id });

    const toOfficeId = args.sendTo[p.id];
    if (!toOfficeId) {
      problems.push(`“${p.nameEn}” has nowhere to go — choose an office for it.`);
      continue;
    }
    const dest = labFor(labs, toOfficeId, p);
    if (!dest) {
      problems.push(
        `The office chosen for “${p.nameEn}” has no ${p.discipline} laboratory to receive it.`,
      );
      continue;
    }
    routes.push({ parameterId: p.id, labId: dest.id });
  }

  if (problems.length) throw new Error(problems.join(" "));

  await prisma.$transaction([
    ...capOn.map((c) =>
      prisma.labCapability.upsert({
        where: { labId_parameterId: { labId: c.labId, parameterId: c.parameterId } },
        create: { ...c, isActive: true, isPlaceholder: false },
        update: { isActive: true, isPlaceholder: false },
      }),
    ),
    ...capOff.map((c) =>
      prisma.labCapability.deleteMany({ where: { labId: c.labId, parameterId: c.parameterId } }),
    ),
    ...routes.map((r) =>
      prisma.labRouting.upsert({
        where: { officeId_parameterId: { officeId: args.officeId, parameterId: r.parameterId } },
        create: {
          officeId: args.officeId, parameterId: r.parameterId, labId: r.labId,
          mode: "in_house", isPlaceholder: false,
        },
        update: { labId: r.labId, isPlaceholder: false },
      }),
    ),
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

  // Which of the destinations just written are waiting on another office.
  const destLabIds = [...new Set(routes.map((r) => r.labId))];
  const declared = new Set(
    (
      await prisma.labCapability.findMany({
        where: { labId: { in: destLabIds }, parameterId: { in: parameters.map((p) => p.id) } },
        select: { labId: true, parameterId: true },
      })
    ).map((c) => `${c.labId}:${c.parameterId}`),
  );
  const pending = routes.filter((r) => !declared.has(`${r.labId}:${r.parameterId}`));

  return { capable: capOn.length, routed: routes.length, pending: pending.length };
}
