/**
 * The 2D map — which laboratory tests what, for an application received where.
 *
 * The server half (D9). `grid.ts` holds the Prisma-free shaping the client
 * components use.
 *
 * **Two tables, not one map** (D64). The client is right that referral is an
 * administrative fact and has to be stored rather than derived — Barisal may
 * send what it cannot test to Cumilla rather than to a nearer, capable Khulna,
 * and no rule about distance or discipline would ever produce that. But a map
 * that stores a destination directly can name a lab that cannot run the test,
 * and nothing would catch it. So:
 *
 * - `LabCapability` is **sparse ground truth**: what a lab can actually run,
 *   maintained by that lab, because nobody else can find out.
 * - `LabRouting` is the **office × parameter map**: where this office sends
 *   that test, maintained by the office.
 *
 * And the rule that joins them: **a destination must hold the capability.**
 * It is enforced here on the way in, and again in `resolveDestinations()` on
 * the way out, because a row written before a lab dropped a capability is
 * still a row pointing somewhere impossible.
 */
import { prisma } from "@/lib/prisma";
import type { LabRoutingMode } from "@/generated/prisma/client";

/** A destination a cell may name, and whether it is usable. */
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
  return prisma.office.findMany({
    orderBy: { id: "asc" },
    select: { id: true, nameEn: true, nameBn: true, _count: { select: { labs: true } } },
  });
}

/**
 * The grid for one package: every parameter against every office.
 *
 * One sub-product at a time, always. The catalogue holds 4,767 parameters and
 * there are 23 offices — the whole map is 109,641 cells, and a screen that
 * tried to render it would be answering a question nobody asks. The question
 * people do ask is "for this product, where does each test go", and that is
 * one package wide.
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
      feePoisha: true, urgentFeePoisha: true,
    },
  });
  const parameterIds = parameters.map((p) => p.id);

  const [routings, capabilities] = await Promise.all([
    prisma.labRouting.findMany({
      where: { parameterId: { in: parameterIds } },
      select: { officeId: true, parameterId: true, labId: true, mode: true, isPlaceholder: true, note: true },
    }),
    prisma.labCapability.findMany({
      where: { parameterId: { in: parameterIds }, isActive: true },
      select: { labId: true, parameterId: true },
    }),
  ]);

  return { subProduct, parameters, routings, capabilities };
}

/**
 * Point a set of this office's parameters at a lab.
 *
 * **Refused if the lab does not hold the capability** (D64), and refused if the
 * lab is closed — a routing row is an instruction to carry a box somewhere, and
 * both of those produce a box that arrives where it cannot be tested. The
 * refusal names the parameters rather than the count, because the fix is to go
 * and tick them on the capability screen and a number does not say which.
 *
 * Writing a row **clears `isPlaceholder`** (D66). Every one of the 109,641
 * seeded rows points at the owning head-office section as a stand-in, and a
 * stand-in that looks identical to a decision is the failure this flag exists
 * to prevent — so the moment an office chooses, it stops being one.
 */
export async function setRouting(args: {
  officeId: number;
  parameterIds: number[];
  labId: number;
  mode?: LabRoutingMode;
  note?: string | null;
}) {
  if (!args.parameterIds.length) return { written: 0 };

  const lab = await prisma.lab.findUnique({
    where: { id: args.labId },
    select: { id: true, nameEn: true, isActive: true },
  });
  if (!lab) throw new Error("No such laboratory.");
  if (!lab.isActive)
    throw new Error(`${lab.nameEn} is closed, so samples cannot be sent there.`);

  const capable = new Set(
    (
      await prisma.labCapability.findMany({
        where: { labId: args.labId, parameterId: { in: args.parameterIds }, isActive: true },
        select: { parameterId: true },
      })
    ).map((c) => c.parameterId),
  );
  const missing = args.parameterIds.filter((id) => !capable.has(id));
  if (missing.length) {
    const names = await prisma.testParameter.findMany({
      where: { id: { in: missing.slice(0, 5) } },
      select: { nameEn: true },
    });
    throw new Error(
      `${lab.nameEn} has not declared it can run ${missing.length === 1 ? "" : `${missing.length} of these tests, including `}` +
        names.map((n) => `“${n.nameEn}”`).join(", ") +
        `. Record the capability on that lab's page first.`,
    );
  }

  // The map is keyed (office, parameter), so a change is an upsert per cell.
  // Batched in one transaction: a whole package is up to ~90 cells and the
  // office is choosing them as one decision.
  await prisma.$transaction(
    args.parameterIds.map((parameterId) =>
      prisma.labRouting.upsert({
        where: { officeId_parameterId: { officeId: args.officeId, parameterId } },
        create: {
          officeId: args.officeId, parameterId, labId: args.labId,
          mode: args.mode ?? "in_house", isPlaceholder: false,
          note: args.note?.trim() || null,
        },
        update: {
          labId: args.labId, mode: args.mode ?? "in_house", isPlaceholder: false,
          note: args.note?.trim() || null,
        },
      }),
    ),
  );
  return { written: args.parameterIds.length };
}

/**
 * Record what a lab can run.
 *
 * **Withdrawing one does not rewrite the map.** Routing rows pointing here stay
 * exactly as the office left them and start failing the check in
 * `resolveDestinations()` instead, which surfaces as a named problem on the
 * sampling screen. Silently repointing them would move an office's samples
 * somewhere it never agreed to send them — the arbitrariness D64 exists to
 * respect cuts both ways.
 */
export async function setCapability(args: {
  labId: number;
  parameterIds: number[];
  isActive: boolean;
}) {
  if (!args.parameterIds.length) return { written: 0, orphanedRoutings: 0 };

  await prisma.$transaction(
    args.parameterIds.map((parameterId) =>
      prisma.labCapability.upsert({
        where: { labId_parameterId: { labId: args.labId, parameterId } },
        create: { labId: args.labId, parameterId, isActive: args.isActive },
        update: { isActive: args.isActive },
      }),
    ),
  );

  // Say what withdrawing has just broken, rather than leaving it to be found
  // at the moment somebody is trying to seal jars.
  const orphanedRoutings = args.isActive
    ? 0
    : await prisma.labRouting.count({
        where: { labId: args.labId, parameterId: { in: args.parameterIds } },
      });

  return { written: args.parameterIds.length, orphanedRoutings };
}

/** What one lab holds, for its own page. */
export async function labDetail(labId: number) {
  const lab = await prisma.lab.findUnique({
    where: { id: labId },
    select: {
      id: true, nameEn: true, nameBn: true, discipline: true, isActive: true,
      office: { select: { id: true, nameEn: true } },
      orgUnit: { select: { id: true, nameEn: true } },
      _count: { select: { capabilities: true, routings: true } },
    },
  });
  if (!lab) return null;

  // Which packages this lab has said anything about, and how much of each.
  const rows = await prisma.$queryRaw<
    { sub_product_id: number; sub_product: string; product: string; held: bigint; total: bigint }[]
  >`
    SELECT sp.id                                   AS sub_product_id,
           sp."nameEn"                             AS sub_product,
           p."nameEn"                              AS product,
           COUNT(*) FILTER (WHERE lc."isActive")    AS held,
           COUNT(tp.id)                            AS total
      FROM "SubProduct" sp
      JOIN "Product" p        ON p.id = sp."productId"
      JOIN "TestParameter" tp ON tp."subProductId" = sp.id
      LEFT JOIN "LabCapability" lc
             ON lc."parameterId" = tp.id AND lc."labId" = ${labId}
     GROUP BY sp.id, sp."nameEn", p."nameEn"
    HAVING COUNT(*) FILTER (WHERE lc."isActive") > 0
     ORDER BY p."nameEn", sp."nameEn"`;

  return {
    lab,
    packages: rows.map((r) => ({
      subProductId: r.sub_product_id,
      subProduct: r.sub_product,
      product: r.product,
      held: Number(r.held),
      total: Number(r.total),
    })),
  };
}

/**
 * Open or close a laboratory.
 *
 * Not a delete: 46 labs came from the organogram with none invented, and a lab
 * that is closed this year may open next. Closing it takes it out of every
 * destination picker and makes `resolveDestinations()` refuse rows still
 * pointing at it — loudly, and by name, rather than by quietly sending samples
 * to a bench nobody is standing at.
 */
export async function setLabActive(labId: number, isActive: boolean) {
  const lab = await prisma.lab.update({
    where: { id: labId },
    data: { isActive },
    select: { id: true, nameEn: true, isActive: true },
  });
  const affected = isActive ? 0 : await prisma.labRouting.count({ where: { labId } });
  return { lab, affected };
}

/**
 * How much of the map is real, per office.
 *
 * Every seeded row is `isPlaceholder` and points at the owning head-office
 * section (D66), so this is the number that says how far the offices have got.
 * It is the dashboard's whole point: 109,641 cells is not a thing anyone can
 * eyeball.
 */
export async function coverage() {
  const [byOffice, byLab, totals] = await Promise.all([
    prisma.$queryRaw<{ office_id: number; office: string; decided: bigint; total: bigint }[]>`
      SELECT o.id AS office_id, o."nameEn" AS office,
             COUNT(*) FILTER (WHERE NOT lr."isPlaceholder") AS decided,
             COUNT(lr.*)                                    AS total
        FROM "Office" o
        LEFT JOIN "LabRouting" lr ON lr."officeId" = o.id
       GROUP BY o.id, o."nameEn"
       ORDER BY o.id`,
    prisma.$queryRaw<{ lab_id: number; lab: string; office: string; active: boolean; held: bigint }[]>`
      SELECT l.id AS lab_id, l."nameEn" AS lab, o."nameEn" AS office, l."isActive" AS active,
             COUNT(*) FILTER (WHERE lc."isActive") AS held
        FROM "Lab" l
        JOIN "Office" o ON o.id = l."officeId"
        LEFT JOIN "LabCapability" lc ON lc."labId" = l.id
       GROUP BY l.id, l."nameEn", o."nameEn", l."isActive"
       ORDER BY o."nameEn", l."nameEn"`,
    Promise.all([
      prisma.testParameter.count(),
      prisma.subProduct.count(),
      prisma.labRouting.count(),
      prisma.labRouting.count({ where: { isPlaceholder: false } }),
      prisma.lab.count({ where: { isActive: true } }),
      prisma.lab.count(),
    ]),
  ]);

  const [parameters, subProducts, routingRows, routingDecided, labsActive, labsTotal] = totals;
  return {
    parameters, subProducts, routingRows, routingDecided, labsActive, labsTotal,
    offices: byOffice.map((r) => ({
      officeId: r.office_id, office: r.office,
      decided: Number(r.decided), total: Number(r.total),
    })),
    labs: byLab.map((r) => ({
      labId: r.lab_id, lab: r.lab, office: r.office,
      isActive: r.active, held: Number(r.held),
    })),
  };
}
