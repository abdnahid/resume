/**
 * Desks and designations, managed together (D152).
 *
 * **One screen, because they are one decision.** They were two — a designation
 * catalogue and a bulk seating review — and the client's own reading is that
 * an administrator looking at a person wants to set both at once: *"Each
 * employee should have two pick side by side. One for desk select and other for
 * designation select."* Splitting them meant the two lists could disagree about
 * what a job is called, which is the drift `JobTitle` exists to end.
 *
 * **A desk is a post, a designation is a title.** Both titles come from the
 * same catalogue, so they can be compared — but the desk is an
 * `OrgPost`, because the post carries the *unit*, and the unit is what routes a
 * file to a section (D58). Selecting a desk selects a seat; selecting a
 * designation selects a word.
 *
 * **They may differ, and often should.** An Inspector (Metrology) on an
 * Examiner (Chemical) desk because he knows chemistry is D124's case, and it is
 * exactly what the client's example describes — `designationId=5, deskId=6`.
 * The screen shows the difference rather than treating it as an error.
 */
import { prisma } from "@/lib/prisma";
import { deskRank, rankKey } from "@/lib/desk-title";

export type TitleOption = {
  id: number;
  titleEn: string;
  titleBn: string | null;
  rankLabel: string;
  rankOrder: number;
};

export type DeskOption = {
  id: number;
  titleEn: string;
  titleId: number | null;
  unitEn: string;
  unitId: number;
  grade: string | null;
  sanctioned: number;
  held: number;
  rankLabel: string;
};

export type StaffRow = {
  id: string;
  nameEn: string;
  nameBn: string | null;
  grade: string | null;
  category: string | null;
  officeId: number | null;
  officeName: string;

  designationTitleId: number | null;
  /** What the HR export said, kept so a mismatched match can be spotted. */
  recordedEn: string | null;
  recordedBn: string | null;
  designationIsInferred: boolean;

  orgPostId: number | null;
  orgPostIsInferred: boolean;
  actingOrgPostId: number | null;

  /** True when the desk's title and the designation are different ranks. */
  rankDiffers: boolean;
};

/** Every title, for the designation picker. */
export async function titleOptions(): Promise<TitleOption[]> {
  const rows = await prisma.jobTitle.findMany({
    where: { isActive: true },
    select: { id: true, titleEn: true, titleBn: true, rankLabel: true, rankOrder: true },
    orderBy: [{ rankOrder: "asc" }, { titleEn: "asc" }],
  });
  return rows;
}

/**
 * Every post in one office, for the desk picker.
 *
 * **Scoped to the office, because `setDesk()` refuses anything else** — a post
 * outside the employee's own office subtree makes them unreachable by that
 * office's routing, so offering it would be offering a choice the save rejects.
 */
export async function deskOptions(officeId: number): Promise<DeskOption[]> {
  const { officeRoots } = await import("@/lib/desk-service");
  const { unitBelongsToOffice } = await officeRoots();

  const posts = await prisma.orgPost.findMany({
    where: { isActive: true },
    select: {
      id: true,
      nameEn: true,
      titleId: true,
      grade: true,
      sanctionedCount: true,
      unitId: true,
      unit: { select: { nameEn: true } },
      title: { select: { titleEn: true, rankLabel: true } },
      employees: { where: { status: "active" }, select: { id: true } },
    },
    orderBy: { id: "asc" },
  });

  return posts
    .filter((p) => unitBelongsToOffice(p.unitId, officeId))
    .map((p) => ({
      id: p.id,
      titleEn: p.title?.titleEn ?? p.nameEn,
      titleId: p.titleId,
      unitEn: p.unit.nameEn,
      unitId: p.unitId,
      grade: p.grade,
      sanctioned: p.sanctionedCount,
      held: p.employees.length,
      rankLabel: p.title?.rankLabel ?? deskRank(p.nameEn).label,
    }));
}

/** The staff of one office, as the screen lists them. */
export async function staffOfOffice(officeId: number): Promise<StaffRow[]> {
  const people = await prisma.employee.findMany({
    where: { officeId, status: { not: "retired" } },
    select: {
      id: true,
      nameEn: true,
      nameBn: true,
      grade: true,
      category: true,
      officeId: true,
      designationEn: true,
      designationBn: true,
      designationTitleId: true,
      designationIsInferred: true,
      orgPostId: true,
      orgPostIsInferred: true,
      actingOrgPostId: true,
      office: { select: { nameEn: true } },
      designationTitle: { select: { rankLabel: true } },
      orgPost: { select: { nameEn: true, title: { select: { rankLabel: true } } } },
    },
    orderBy: { id: "asc" },
  });

  return people.map((e) => {
    const desigRank =
      e.designationTitle?.rankLabel ?? deskRank(e.designationEn ?? e.designationBn).label;
    const deskRankLabel = e.orgPost
      ? (e.orgPost.title?.rankLabel ?? deskRank(e.orgPost.nameEn).label)
      : null;
    return {
      id: e.id,
      nameEn: e.nameEn,
      nameBn: e.nameBn,
      grade: e.grade ? String(e.grade) : null,
      category: e.category ? String(e.category) : null,
      officeId: e.officeId,
      officeName: e.office?.nameEn ?? "—",
      designationTitleId: e.designationTitleId,
      recordedEn: e.designationEn,
      recordedBn: e.designationBn,
      designationIsInferred: e.designationIsInferred,
      orgPostId: e.orgPostId,
      orgPostIsInferred: e.orgPostIsInferred,
      actingOrgPostId: e.actingOrgPostId,
      rankDiffers: !!deskRankLabel && rankKey(deskRankLabel) !== rankKey(desigRank),
    };
  });
}

/**
 * Set one person's designation title.
 *
 * **Choosing it is what makes it no longer a guess**, so this clears
 * `designationIsInferred` — the same act, and the same reasoning, as confirming
 * a seat clears `orgPostIsInferred` (D131).
 *
 * **`designationEn` is kept in step**, because it is what every screen that has
 * not been migrated to the catalogue still reads, and two columns describing
 * one fact must not disagree while both are live. The Bengali is written only
 * when the title carries one, so a title with no Bengali does not blank a
 * Bengali name the export supplied.
 */
export async function setDesignationTitle(args: { employeeId: string; titleId: number | null }) {
  const e = await prisma.employee.findUnique({
    where: { id: args.employeeId },
    select: { id: true, nameEn: true },
  });
  if (!e) throw new Error("No such employee.");

  if (args.titleId === null) {
    await prisma.employee.update({
      where: { id: e.id },
      data: { designationTitleId: null, designationIsInferred: true },
    });
    return { employeeId: e.id, name: e.nameEn, title: null };
  }

  const t = await prisma.jobTitle.findUnique({
    where: { id: args.titleId },
    select: { id: true, titleEn: true, titleBn: true, isActive: true },
  });
  if (!t) throw new Error("No such job title.");
  if (!t.isActive) throw new Error(`"${t.titleEn}" is not an active title.`);

  await prisma.employee.update({
    where: { id: e.id },
    data: {
      designationTitleId: t.id,
      designationIsInferred: false,
      designationEn: t.titleEn,
      ...(t.titleBn ? { designationBn: t.titleBn } : {}),
    },
  });
  return { employeeId: e.id, name: e.nameEn, title: t.titleEn };
}

/** Add a title to the catalogue, or return the one that already matches. */
export async function addTitle(titleEn: string, titleBn?: string | null): Promise<TitleOption> {
  const t = titleEn.trim();
  if (!t) throw new Error("A title cannot be blank.");
  const key = rankKey(t);
  const existing = await prisma.jobTitle.findUnique({
    where: { titleKey: key },
    select: { id: true, titleEn: true, titleBn: true, rankLabel: true, rankOrder: true },
  });
  if (existing) return existing;

  const r = deskRank(t);
  return prisma.jobTitle.create({
    data: {
      titleEn: t,
      titleBn: titleBn?.trim() || null,
      titleKey: key,
      rankLabel: r.label,
      rankOrder: r.order,
    },
    select: { id: true, titleEn: true, titleBn: true, rankLabel: true, rankOrder: true },
  });
}
