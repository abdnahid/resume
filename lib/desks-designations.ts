/**
 * Desks and designations — two tables, because they are two shapes (D153).
 *
 * **A desk is per office; a designation is not.** The client's rule,
 * 2026-09-21: *"A desk named Assistant Director (Chemical) can be from Khulna
 * office and Rajshahi Office and Mymensingh office etc. All of those should be
 * identified differently. But as designation we don't need to keep multiple
 * similar titled entry because designations are unique and an employee carries
 * that with his name."*
 *
 * So a desk stays an `OrgPost` — one row per seat per section, which is also
 * what carries the unit that routes a file (D58) — and a designation is one
 * `Designation` row held by everybody of that rank.
 *
 * **One designation, many desks.** One is primary and the rest are additional
 * charges. `EmployeeDesk` is the authority; `Employee.orgPostId` and
 * `actingOrgPostId` are kept in step as mirrors for the 51 call sites that
 * still read them.
 */
import { prisma } from "@/lib/prisma";
import { deskRank, rankKey } from "@/lib/desk-title";
import {
  designationGroup,
  type DesignationOption,
  type DeskOption,
  type HeldDesk,
  type StaffRow,
} from "@/lib/desks-view";

export type {
  DesignationOption,
  DeskOption,
  HeldDesk,
  StaffRow,
} from "@/lib/desks-view";
export { STAFF_GROUP, designationGroup } from "@/lib/desks-view";

export async function designationOptions(): Promise<DesignationOption[]> {
  const rows = await prisma.designation.findMany({
    where: { isActive: true },
    select: {
      id: true,
      titleEn: true,
      titleBn: true,
      rankLabel: true,
      rankOrder: true,
      isOfficer: true,
      wing: true,
    },
    orderBy: [{ isOfficer: "desc" }, { wing: "asc" }, { rankOrder: "asc" }, { titleEn: "asc" }],
  });
  return rows.map((r) => ({ ...r, group: designationGroup(r) }));
}

/**
 * The desks of one office, for the desk picker.
 *
 * **Only that office's organogram**, which is the client's point: *"When I am
 * setting Khulna office employees, I only want to pick from Khulna organogram
 * desk."* It is also what `setDesk()` already enforces — a post outside the
 * employee's own office subtree makes them unreachable by that office's
 * routing — so a wider list would only offer choices the save rejects.
 */
export async function deskOptions(officeId: number): Promise<DeskOption[]> {
  const { officeRoots } = await import("@/lib/desk-service");
  const { unitBelongsToOffice } = await officeRoots();

  const posts = await prisma.orgPost.findMany({
    where: { isActive: true },
    select: {
      id: true,
      nameEn: true,
      grade: true,
      sanctionedCount: true,
      isSanctioned: true,
      seatNo: true,
      unitId: true,
      unit: { select: { nameEn: true } },
      holders: {
        where: { releasedAt: null },
        select: { id: true, employee: { select: { nameEn: true } } },
      },
    },
    orderBy: [{ unitId: "asc" }, { nameEn: "asc" }, { seatNo: "asc" }],
  });

  return posts
    .filter((p) => unitBelongsToOffice(p.unitId, officeId))
    .map((p) => ({
      id: p.id,
      titleEn: p.nameEn,
      unitEn: p.unit.nameEn,
      unitId: p.unitId,
      grade: p.grade,
      sanctioned: p.sanctionedCount,
      held: p.holders.length,
      rankLabel: deskRank(p.nameEn).label,
      isSanctioned: p.isSanctioned,
      seatNo: p.seatNo,
      heldBy: p.holders[0]?.employee.nameEn ?? null,
    }));
}

/**
 * Every unit's position in the chart, read depth-first (D158).
 *
 * **`sortOrder` is per parent, so it cannot order sections against each
 * other.** Head office's *Document Control* is first inside its own wing and
 * came out first in the whole office, above the Director's own section. Walking
 * the tree in the order the organogram is drawn — roots by `sortOrder`, then
 * their children, and so on — gives a single number per unit that means "how
 * far down the chart this section sits".
 */
async function chartOrder(): Promise<Map<number, number>> {
  const units = await prisma.orgUnit.findMany({
    select: { id: true, parentId: true, sortOrder: true, nameEn: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  const children = new Map<number | null, typeof units>();
  for (const u of units) {
    const k = u.parentId ?? null;
    if (!children.has(k)) children.set(k, []);
    children.get(k)!.push(u);
  }
  const order = new Map<number, number>();
  let n = 0;
  const walk = (parentId: number | null) => {
    for (const u of children.get(parentId) ?? []) {
      order.set(u.id, n++);
      walk(u.id);
    }
  };
  walk(null);
  return order;
}

export async function staffOfOffice(officeId: number): Promise<StaffRow[]> {
  const chart = await chartOrder();
  const people = await prisma.employee.findMany({
    where: { officeId, status: { not: "retired" } },
    select: {
      id: true,
      nameEn: true,
      nameBn: true,
      grade: true,
      officeId: true,
      designationId: true,
      designationEn: true,
      designationBn: true,
      designationIsInferred: true,
      orgPostIsInferred: true,
      designation: { select: { rankLabel: true, isOfficer: true, wing: true } },
      desks: {
        // Open tenures only — a released one is history, not a desk they hold.
        where: { releasedAt: null },
        select: {
          orgPostId: true,
          kind: true,
          note: true,
          orgPost: {
            select: {
              nameEn: true,
              unitId: true,
              unit: { select: { nameEn: true } },
            },
          },
        },
        orderBy: [{ kind: "asc" }, { id: "asc" }],
      },
    },
    orderBy: { id: "asc" },
  });

  return people.map((e) => {
    const desks: HeldDesk[] = e.desks.map((d) => ({
      orgPostId: d.orgPostId,
      titleEn: d.orgPost.nameEn,
      unitEn: d.orgPost.unit.nameEn,
      kind: d.kind,
      isPrimary: d.kind === "substantive",
      note: d.note,
    }));
    const primary = desks.find((d) => d.isPrimary) ?? null;
    const primaryUnitId = e.desks.find((d) => d.kind === "substantive")?.orgPost.unitId;
    const primaryUnitOrder =
      primaryUnitId !== undefined ? (chart.get(primaryUnitId) ?? 9999) : 9999;
    const desigRank =
      e.designation?.rankLabel ?? deskRank(e.designationEn ?? e.designationBn).label;
    return {
      id: e.id,
      nameEn: e.nameEn,
      nameBn: e.nameBn,
      grade: e.grade ? String(e.grade) : null,
      officeId: e.officeId,
      designationId: e.designationId,
      recordedEn: e.designationEn,
      designationIsInferred: e.designationIsInferred,
      // **Grade decides the band, the designation decides the wing.** A person
      // with no designation set falls to the grade, so the roster still sorts.
      isOfficer: e.designation?.isOfficer ?? (e.grade ? Number(e.grade) <= 9 : false),
      wing: e.designation?.wing ?? null,
      // The section is the organogram's, taken from the desk they hold (D158a).
      sectionEn: primary?.unitEn ?? null,
      sectionOrder: primaryUnitOrder,
      desks,
      primaryPostId: primary?.orgPostId ?? null,
      deskIsInferred: e.orgPostIsInferred,
      rankDiffers: !!primary && rankKey(deskRank(primary.titleEn).label) !== rankKey(desigRank),
    };
  });
}

/** Set one person's designation. Choosing it is what makes it not a guess. */
export async function setDesignation(args: { employeeId: string; designationId: number | null }) {
  const e = await prisma.employee.findUnique({
    where: { id: args.employeeId },
    select: { id: true, nameEn: true },
  });
  if (!e) throw new Error("No such employee.");

  if (args.designationId === null) {
    await prisma.employee.update({
      where: { id: e.id },
      data: { designationId: null, designationIsInferred: true },
    });
    return { employeeId: e.id, name: e.nameEn, title: null };
  }

  const d = await prisma.designation.findUnique({
    where: { id: args.designationId },
    select: { id: true, titleEn: true, titleBn: true, isActive: true },
  });
  if (!d) throw new Error("No such designation.");
  if (!d.isActive) throw new Error(`"${d.titleEn}" is not an active designation.`);

  // `designationEn`/`Bn` stay in step — they are the import record, but every
  // screen not yet migrated still reads them, and two columns describing one
  // fact must not disagree while both are live.
  await prisma.employee.update({
    where: { id: e.id },
    data: {
      designationId: d.id,
      designationIsInferred: false,
      designationEn: d.titleEn,
      ...(d.titleBn ? { designationBn: d.titleBn } : {}),
    },
  });
  return { employeeId: e.id, name: e.nameEn, title: d.titleEn };
}

/**
 * Replace the whole set of desks somebody holds.
 *
 * **Replaced, not diffed**, for the reason the inspection team list is: a list
 * merged row by row leaves somebody on a desk because nobody remembered to take
 * them off it.
 *
 * **Exactly one primary**, enforced here rather than by the database — a
 * partial unique index is not expressible in Prisma's schema, and the rule
 * belongs with the rest of them anyway. A single desk is primary by definition;
 * several with none marked is refused rather than guessed at.
 *
 * **The office is checked per post**, the same rule `setDesk()` applies: a post
 * outside the employee's own office subtree makes them unreachable by that
 * office's routing.
 */
export async function setDesks(args: {
  employeeId: string;
  desks: { orgPostId: number; isPrimary: boolean; note?: string | null }[];
}) {
  const e = await prisma.employee.findUnique({
    where: { id: args.employeeId },
    select: { id: true, nameEn: true, officeId: true },
  });
  if (!e) throw new Error("No such employee.");

  const wanted = [...new Map(args.desks.map((d) => [d.orgPostId, d])).values()];

  if (wanted.length) {
    const primaries = wanted.filter((d) => d.isPrimary);
    if (wanted.length === 1) wanted[0].isPrimary = true;
    else if (primaries.length !== 1) {
      throw new Error(
        primaries.length === 0
          ? "Mark one desk as the primary one; the rest are additional charges."
          : "Only one desk can be the primary one.",
      );
    }

    const { officeRoots } = await import("@/lib/desk-service");
    const { unitBelongsToOffice } = await officeRoots();
    const posts = await prisma.orgPost.findMany({
      where: { id: { in: wanted.map((d) => d.orgPostId) } },
      select: { id: true, nameEn: true, isActive: true, unitId: true, unit: { select: { nameEn: true } } },
    });
    for (const d of wanted) {
      const p = posts.find((x) => x.id === d.orgPostId);
      if (!p) throw new Error(`Post ${d.orgPostId} does not exist.`);
      if (!p.isActive) throw new Error(`${p.nameEn} is not an active post.`);
      if (!unitBelongsToOffice(p.unitId, e.officeId)) {
        throw new Error(
          `${p.nameEn} sits in ${p.unit.nameEn}, which is not in this employee's office.`,
        );
      }
    }
  }

  const primary = wanted.find((d) => d.isPrimary) ?? null;
  const acting = wanted.filter((d) => !d.isPrimary);

  await prisma.$transaction([
    prisma.employeeDesk.deleteMany({ where: { employeeId: e.id } }),
    ...(wanted.length
      ? [
          prisma.employeeDesk.createMany({
            data: wanted.map((d) => ({
              employeeId: e.id,
              orgPostId: d.orgPostId,
              isPrimary: d.isPrimary,
              note: d.note ?? null,
            })),
          }),
        ]
      : []),
    // The mirrors. `actingOrgPostId` holds one, so it takes the first
    // additional charge; the table is where all of them live.
    prisma.employee.update({
      where: { id: e.id },
      data: {
        orgPostId: primary?.orgPostId ?? null,
        actingOrgPostId: acting[0]?.orgPostId ?? null,
        // Choosing a seat is what makes "a script guessed this" untrue (D131).
        orgPostIsInferred: false,
      },
    }),
  ]);

  return { employeeId: e.id, name: e.nameEn, desks: wanted.length, acting: acting.length };
}
