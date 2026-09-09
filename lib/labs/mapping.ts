/**
 * Which offices can test what, and where a sample goes — the server half (D9).
 * `grid.ts` holds the Prisma-free shaping the client components use.
 *
 * **The model inverted on 2026-09-09** (D116). It used to be two tables of the
 * same width: `LabCapability`, one row per lab per parameter, and `LabRouting`,
 * an office × parameter map with a single destination in every one of its
 * 109,802 cells. Both had to be filled in before anything resolved, and neither
 * ever was.
 *
 * Now there is one sparse table and one optional one:
 *
 * - **`ParameterCapability`** — a row exists only where an office has said it
 *   covers a test. Silence means it does not. That is what makes the data entry
 *   finite: an office lists what it *can* do and never answers for the 4,774
 *   tests it cannot.
 * - **`RoutingPreference`** — optional. D64's point stands that referral is
 *   administrative, so Barisal may prefer Cumilla over a nearer, capable
 *   Khulna; but with the destination derivable from capability, a preference
 *   only breaks a tie. No row means the field officer chooses.
 *
 * **Capability is the office's, not the laboratory's**, because an office may
 * cover a test it has no bench for — Faridpur holds only a chemistry lab and
 * can still send a physical test out under `third_party` and enter the result
 * through its own examiner. `labFor()` in `coverage.ts` names the bench when
 * there is one.
 */
import { prisma } from "@/lib/prisma";
import type { CapabilityManner } from "@/generated/prisma/client";
import { labFor, resolvableLabs } from "./coverage";

export type LabOption = {
  id: number;
  nameEn: string;
  discipline: string;
  officeId: number;
  officeName: string;
  isActive: boolean;
};

export async function labOptions(): Promise<LabOption[]> {
  const labs = await prisma.lab.findMany({
    orderBy: [{ officeId: "asc" }, { nameEn: "asc" }],
    select: {
      id: true, nameEn: true, discipline: true, isActive: true,
      office: { select: { id: true, nameEn: true } },
    },
  });
  return labs.map((l) => ({
    id: l.id, nameEn: l.nameEn, discipline: l.discipline,
    officeId: l.office.id, officeName: l.office.nameEn, isActive: l.isActive,
  }));
}

export async function officeOptions() {
  const offices = await prisma.office.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true, nameEn: true, nameBn: true,
      _count: { select: { labs: true } },
      labs: { where: { isActive: true }, select: { discipline: true } },
    },
  });
  return offices.map((o) => ({
    id: o.id, nameEn: o.nameEn, nameBn: o.nameBn,
    _count: o._count,
    /** The kinds of test its open benches can run without sending them out. */
    disciplines: [...new Set(o.labs.map((l) => l.discipline))],
  }));
}

/**
 * One package: every parameter, every office that can test it, and this
 * office's preferences.
 *
 * One sub-product at a time, always. There are 4,774 parameters and 23 offices;
 * the question people bring is "for this product, who can test each of these
 * and where does it go", which is one package wide.
 */
export async function mapFor(subProductId: number) {
  const subProduct = await prisma.subProduct.findUnique({
    where: { id: subProductId },
    select: {
      id: true, nameEn: true, standardAsPrinted: true,
      product: { select: { id: true, serial: true, nameEn: true } },
    },
  });
  if (!subProduct) return null;

  const parameters = await prisma.testParameter.findMany({
    where: { subProductId },
    orderBy: [{ ordinal: "asc" }, { id: "asc" }],
    select: {
      id: true, nameEn: true, discipline: true, sourceSection: true,
      feePoisha: true, urgentFeePoisha: true, normalDays: true, urgentDays: true,
    },
  });
  const parameterIds = parameters.map((p) => p.id);

  const [capabilities, preferences] = await Promise.all([
    prisma.parameterCapability.findMany({
      where: { parameterId: { in: parameterIds }, isActive: true },
      select: { officeId: true, parameterId: true, manner: true, labId: true },
    }),
    prisma.routingPreference.findMany({
      where: { parameterId: { in: parameterIds } },
      select: { officeId: true, parameterId: true, toOfficeId: true, note: true },
    }),
  ]);

  return { subProduct, parameters, capabilities, preferences };
}

/**
 * Record — or withdraw — what an office covers.
 *
 * The bench is **resolved, not asked for**: the parameter's discipline picks it
 * at a branch, and at head office its section does. Asking a data-entry
 * operator to choose between Organic Chemistry and Food & Bacteriology 4,774
 * times is asking a question they cannot answer.
 *
 * `third_party` needs no bench at all — that is the case it exists for — so it
 * is never refused for want of one.
 */
export async function setCapability(args: {
  officeId: number;
  parameterIds: number[];
  manner?: CapabilityManner;
  isActive?: boolean;
  employeeId?: string | null;
  note?: string | null;
}) {
  if (!args.parameterIds.length) return { written: 0, problems: [] as string[] };
  const manner = args.manner ?? "in_house";
  const isActive = args.isActive ?? true;

  const [labs, parameters] = await Promise.all([
    resolvableLabs(),
    prisma.testParameter.findMany({
      where: { id: { in: args.parameterIds } },
      select: { id: true, nameEn: true, discipline: true, sourceSection: true },
    }),
  ]);

  const problems: string[] = [];
  const rows: { parameterId: number; labId: number | null }[] = [];
  for (const p of parameters) {
    const own = labFor(labs, args.officeId, p);
    if (manner === "in_house" && !own) {
      problems.push(
        `“${p.nameEn}” is a ${p.discipline} test and this office has no ${p.discipline} laboratory — record it as sent out instead.`,
      );
      continue;
    }
    rows.push({ parameterId: p.id, labId: manner === "in_house" ? own!.id : null });
  }
  if (problems.length && !rows.length) throw new Error(problems.join(" "));

  await prisma.$transaction(
    rows.map((r) =>
      prisma.parameterCapability.upsert({
        where: { officeId_parameterId: { officeId: args.officeId, parameterId: r.parameterId } },
        create: {
          officeId: args.officeId, parameterId: r.parameterId,
          manner, labId: r.labId, isActive,
          declaredByEmployeeId: args.employeeId ?? null,
          note: args.note?.trim() || null,
        },
        update: {
          manner, labId: r.labId, isActive,
          declaredAt: new Date(),
          declaredByEmployeeId: args.employeeId ?? null,
          note: args.note?.trim() || null,
        },
      }),
    ),
  );
  return { written: rows.length, problems };
}

/** Stop covering a set of tests. The rows go rather than being deactivated —
 *  absence is what "we do not do this" means now, and a false row reads as a
 *  claim. Preferences pointing here are left alone and start failing loudly. */
export async function dropCapability(officeId: number, parameterIds: number[]) {
  if (!parameterIds.length) return { removed: 0, orphanedPreferences: 0 };
  const orphanedPreferences = await prisma.routingPreference.count({
    where: { toOfficeId: officeId, parameterId: { in: parameterIds } },
  });
  const r = await prisma.parameterCapability.deleteMany({
    where: { officeId, parameterId: { in: parameterIds } },
  });
  return { removed: r.count, orphanedPreferences };
}

/**
 * Where this office prefers to send a test it cannot run.
 *
 * **A destination that has not declared the capability is allowed, and
 * reported** (D110, unchanged). Barisal knows perfectly well that Khulna runs a
 * test; refusing until somebody at Khulna has filled in their own form
 * deadlocks the institution on whoever went first. `resolveDestinations()`
 * still refuses to *follow* such a preference, by name, days before a sample
 * moves.
 */
export async function setPreference(args: {
  officeId: number;
  parameterIds: number[];
  toOfficeId: number | null;
  note?: string | null;
}) {
  if (!args.parameterIds.length) return { written: 0, pending: 0 };

  // Clearing a preference is a real act: it hands the choice back to the field
  // officer rather than leaving a stale destination standing.
  if (args.toOfficeId === null) {
    const r = await prisma.routingPreference.deleteMany({
      where: { officeId: args.officeId, parameterId: { in: args.parameterIds } },
    });
    return { written: r.count, pending: 0, cleared: true };
  }

  const capable = new Set(
    (
      await prisma.parameterCapability.findMany({
        where: {
          officeId: args.toOfficeId,
          parameterId: { in: args.parameterIds },
          isActive: true,
        },
        select: { parameterId: true },
      })
    ).map((c) => c.parameterId),
  );

  await prisma.$transaction(
    args.parameterIds.map((parameterId) =>
      prisma.routingPreference.upsert({
        where: { officeId_parameterId: { officeId: args.officeId, parameterId } },
        create: {
          officeId: args.officeId, parameterId,
          toOfficeId: args.toOfficeId!, note: args.note?.trim() || null,
        },
        update: { toOfficeId: args.toOfficeId!, note: args.note?.trim() || null },
      }),
    ),
  );
  return {
    written: args.parameterIds.length,
    pending: args.parameterIds.filter((id) => !capable.has(id)).length,
  };
}

/** What one laboratory's office has declared it runs on that bench. */
export async function labDetail(labId: number) {
  const lab = await prisma.lab.findUnique({
    where: { id: labId },
    select: {
      id: true, nameEn: true, nameBn: true, discipline: true, isActive: true,
      office: { select: { id: true, nameEn: true } },
      orgUnit: { select: { id: true, nameEn: true } },
    },
  });
  if (!lab) return null;

  const [declared, sentOut] = await Promise.all([
    prisma.parameterCapability.count({ where: { labId, isActive: true } }),
    prisma.parameterCapability.count({
      where: { officeId: lab.office.id, manner: "third_party", isActive: true },
    }),
  ]);

  const rows = await prisma.$queryRaw<
    { sub_product_id: number; sub_product: string; product: string; held: bigint; total: bigint }[]
  >`
    SELECT sp.id AS sub_product_id, sp."nameEn" AS sub_product, p."nameEn" AS product,
           COUNT(*) FILTER (WHERE pc."isActive")  AS held,
           COUNT(tp.id)                           AS total
      FROM "SubProduct" sp
      JOIN "Product" p        ON p.id = sp."productId"
      JOIN "TestParameter" tp ON tp."subProductId" = sp.id
      LEFT JOIN "ParameterCapability" pc
             ON pc."parameterId" = tp.id AND pc."labId" = ${labId}
     WHERE sp."foldedAt" IS NULL
     GROUP BY sp.id, sp."nameEn", p."nameEn"
    HAVING COUNT(*) FILTER (WHERE pc."isActive") > 0
     ORDER BY p."nameEn", sp."nameEn"`;

  return {
    lab, declared, sentOut,
    packages: rows.map((r) => ({
      subProductId: r.sub_product_id, subProduct: r.sub_product, product: r.product,
      held: Number(r.held), total: Number(r.total),
    })),
  };
}

/**
 * Open or close a laboratory.
 *
 * Not a delete: 46 labs came from the organogram with none invented, and one
 * closed this year may open next. Closing it takes its office's in-house
 * capabilities out of use — loudly, by name, rather than by quietly sending
 * samples to a bench nobody is standing at.
 */
export async function setLabActive(labId: number, isActive: boolean) {
  const lab = await prisma.lab.update({
    where: { id: labId },
    data: { isActive },
    select: { id: true, nameEn: true, isActive: true },
  });
  const affected = isActive
    ? 0
    : await prisma.parameterCapability.count({ where: { labId, isActive: true } });
  return { lab, affected };
}

/**
 * How much of the catalogue anybody can actually test.
 *
 * The number that matters is no longer "how much of the map is decided" — there
 * is no map to fill. It is **how many tests have no capable office at all**,
 * because those are the ones an application will fall through on.
 */
export async function coverage() {
  const [byOffice, byLab, totals, orphanRows] = await Promise.all([
    prisma.$queryRaw<
      { office_id: number; office: string; in_house: bigint; third_party: bigint; preferences: bigint }[]
    >`
      SELECT o.id AS office_id, o."nameEn" AS office,
             COUNT(*) FILTER (WHERE pc.manner = 'in_house'    AND pc."isActive") AS in_house,
             COUNT(*) FILTER (WHERE pc.manner = 'third_party' AND pc."isActive") AS third_party,
             (SELECT COUNT(*) FROM "RoutingPreference" rp WHERE rp."officeId" = o.id) AS preferences
        FROM "Office" o
        LEFT JOIN "ParameterCapability" pc ON pc."officeId" = o.id
       GROUP BY o.id, o."nameEn"
       ORDER BY o.id`,
    prisma.$queryRaw<{ lab_id: number; lab: string; office: string; active: boolean; held: bigint }[]>`
      SELECT l.id AS lab_id, l."nameEn" AS lab, o."nameEn" AS office, l."isActive" AS active,
             COUNT(*) FILTER (WHERE pc."isActive") AS held
        FROM "Lab" l
        JOIN "Office" o ON o.id = l."officeId"
        LEFT JOIN "ParameterCapability" pc ON pc."labId" = l.id
       GROUP BY l.id, l."nameEn", o."nameEn", l."isActive"
       ORDER BY o."nameEn", l."nameEn"`,
    Promise.all([
      prisma.testParameter.count(),
      prisma.subProduct.count({ where: { foldedAt: null } }),
      prisma.parameterCapability.count({ where: { isActive: true } }),
      prisma.routingPreference.count(),
      prisma.lab.count({ where: { isActive: true } }),
      prisma.lab.count(),
      prisma.officeSubProductScope.count(),
    ]),
    prisma.testParameter.count({ where: { officeCapabilities: { none: { isActive: true } } } }),
  ]);

  const [parameters, subProducts, capabilityRows, preferenceRows, labsActive, labsTotal, scopeRows] =
    totals;
  return {
    parameters, subProducts, capabilityRows, preferenceRows, labsActive, labsTotal, scopeRows,
    /** Tests no office can run. Every one is an application that cannot resolve. */
    parametersWithNoCapableOffice: orphanRows,
    offices: byOffice.map((r) => ({
      officeId: r.office_id, office: r.office,
      inHouse: Number(r.in_house), thirdParty: Number(r.third_party),
      preferences: Number(r.preferences),
      total: Number(r.in_house) + Number(r.third_party),
    })),
    labs: byLab.map((r) => ({
      labId: r.lab_id, lab: r.lab, office: r.office,
      isActive: r.active, declared: Number(r.held),
    })),
  };
}
