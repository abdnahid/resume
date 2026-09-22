/**
 * Desks outside the approved establishment (D155).
 *
 * **Why they exist.** BSTI's organogram is approved by a rigorous government
 * process, so a post that is not on it cannot simply be created — but somebody
 * has to be seated today, and in this system a desk is what files and work
 * orders attach to. A person with no desk cannot be given work at all, and when
 * they leave a desk the next holder inherits what is on it. So the desk must be
 * a real, durable thing even while the sanction is pending.
 *
 * **It is an `OrgPost` with a flag, not a second table.** Everything downstream
 * reads `OrgPost` — routing (D58), the pass-down chain, the laboratory ladder,
 * custody of a work order — and a desk in a parallel table could not hold any
 * of it. The flag also makes regularisation a flag flip rather than a
 * migration: when the approval comes through the post joins the establishment
 * and **the files stay exactly where they are**.
 *
 * **`sanctionedCount: 0` is the whole trick.** Every count already in the
 * system then reads correctly without a line of change — *held 1/0* is
 * precisely "one person, no sanctioned seat" — and over-strength, which is
 * `holders − sanctioned`, picks these up for free.
 */
import { prisma } from "@/lib/prisma";
import { deskRank } from "@/lib/desk-title";

/**
 * Create a section outside the organogram (D157).
 *
 * **A desk needs somewhere to hang.** Faridpur runs no physical testing, so the
 * chart has no Physical Lab there and an *Assistant Director (Civil, Physical)*
 * had nowhere to sit that meant anything. Putting the desk under Administration
 * or CM would have been worse than leaving him unseated: the unit is what
 * routes a file (D58), so his work would have gone to the wrong section rather
 * than to none.
 *
 * Marked and reasoned like a temporary post, and regularised the same way — a
 * flag flip, so nothing under it moves.
 */
export async function createTemporaryUnit(input: {
  parentId: number;
  nameEn: string;
  nameBn: string;
  reason: string;
}) {
  const nameEn = input.nameEn.trim();
  const nameBn = input.nameBn.trim();
  const reason = input.reason.trim();
  if (!nameEn || !nameBn) throw new Error("A section needs a name in both languages.");
  if (!reason) throw new Error("Say why this section is being created outside the organogram.");

  const parent = await prisma.orgUnit.findUnique({
    where: { id: input.parentId },
    select: { id: true, nameEn: true, isActive: true },
  });
  if (!parent) throw new Error("No such parent unit.");
  if (!parent.isActive) throw new Error(`${parent.nameEn} is not an active unit.`);

  // A slug is unique across the chart; derive one and make it not collide.
  const base = nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  let slug = base;
  for (let n = 2; await prisma.orgUnit.findUnique({ where: { slug }, select: { id: true } }); n++) {
    slug = `${base}-${n}`;
  }

  const last = await prisma.orgUnit.findFirst({
    where: { parentId: parent.id },
    select: { sortOrder: true },
    orderBy: { sortOrder: "desc" },
  });

  return prisma.orgUnit.create({
    data: {
      parentId: parent.id,
      slug,
      nameEn,
      nameBn,
      category: "unit",
      sortOrder: (last?.sortOrder ?? 0) + 1,
      isSanctioned: false,
      createdReason: reason,
    },
    select: { id: true, nameEn: true, nameBn: true },
  });
}

export type TemporaryDeskInput = {
  unitId: number;
  nameEn: string;
  nameBn: string;
  /** Required. A post outside the establishment must say why it was made. */
  reason: string;
  createdByEmployeeId?: string | null;
};

/**
 * Create a desk outside the organogram.
 *
 * **The unit is the real decision, not the title.** The unit is what routes a
 * file to a section, so a temporary *Computer Operator* desk in
 * `Administration, Faridpur` receives different work from one in
 * `CM, Faridpur`. The caller must have chosen it deliberately.
 *
 * **The reason is required**, and that is not ceremony: a post outside the
 * approved establishment is the first thing an auditor asks about.
 *
 * **Never called by a script.** `import:desks` and `fix:seat-by-designation`
 * only ever fill sanctioned posts; creating an establishment exception is a
 * human decision with a name attached to it.
 */
export async function createTemporaryDesk(input: TemporaryDeskInput) {
  const nameEn = input.nameEn.trim();
  const nameBn = input.nameBn.trim();
  const reason = input.reason.trim();
  if (!nameEn || !nameBn) throw new Error("A desk needs a name in both languages.");
  if (!reason) throw new Error("Say why this desk is being created outside the organogram.");

  const unit = await prisma.orgUnit.findUnique({
    where: { id: input.unitId },
    select: { id: true, nameEn: true, isActive: true },
  });
  if (!unit) throw new Error("No such unit.");
  if (!unit.isActive) throw new Error(`${unit.nameEn} is not an active unit.`);

  const post = await prisma.orgPost.create({
    data: {
      unitId: unit.id,
      nameEn,
      nameBn,
      // Zero, so every existing count reads right and the post shows as an
      // exception rather than as capacity somebody may fill.
      sanctionedCount: 0,
      isSanctioned: false,
      createdReason: reason,
      createdByEmployeeId: input.createdByEmployeeId ?? null,
      // Graded from the title, the same rule the pickers use, so a temporary
      // desk sorts and groups with its sanctioned equivalents.
      grade: null,
    },
    select: { id: true, nameEn: true, unit: { select: { nameEn: true } } },
  });

  return { ...post, rankLabel: deskRank(post.nameEn).label };
}

/**
 * The approval came through: the post joins the establishment.
 *
 * **Nothing moves.** The holders, the files on their desks and the work orders
 * in flight are all attached to this post id and stay attached — which is the
 * reason this is a flag on the existing row rather than a new sanctioned post
 * somebody would have to be transferred onto.
 *
 * `sanctionedCount` is set to what the memo approves, defaulting to the number
 * of people already sitting there, because that is what was being regularised.
 */
export async function regulariseDesk(args: {
  orgPostId: number;
  memoNo: string;
  sanctionedCount?: number;
}) {
  const memoNo = args.memoNo.trim();
  if (!memoNo) throw new Error("A regularisation needs the memo number that approved it.");

  const post = await prisma.orgPost.findUnique({
    where: { id: args.orgPostId },
    select: {
      id: true,
      nameEn: true,
      isSanctioned: true,
      holders: { where: { releasedAt: null, kind: "substantive" }, select: { id: true } },
    },
  });
  if (!post) throw new Error("No such post.");
  if (post.isSanctioned) throw new Error(`${post.nameEn} is already part of the establishment.`);

  const count = args.sanctionedCount ?? Math.max(post.holders.length, 1);
  return prisma.orgPost.update({
    where: { id: post.id },
    data: {
      isSanctioned: true,
      sanctionedCount: count,
      regularisedAt: new Date(),
      regularisedMemoNo: memoNo,
    },
    select: { id: true, nameEn: true, sanctionedCount: true, regularisedMemoNo: true },
  });
}

export type ManpowerLine = {
  officeId: number;
  officeName: string;
  /** Posts on the approved establishment, and their total sanctioned seats. */
  sanctionedPosts: number;
  sanctionedSeats: number;
  /** People holding a primary desk in this office. */
  posted: number;
  /** Of those, how many sit on a desk outside the organogram. */
  postedOutside: number;
  /** Desks outside the organogram, whether or not anybody is on them. */
  temporaryDesks: number;
  /** posted − sanctionedSeats, where positive. */
  overStrength: number;
};

/**
 * Manpower by office, with the establishment exceptions called out.
 *
 * **Three numbers, not one.** Sanctioned strength is what the government
 * approved; posted is who is actually there; posted-outside is the part of the
 * second that the first does not cover. Reporting only the first two hides
 * exactly the thing the exception was created to make visible.
 */
export async function manpowerByOffice(): Promise<ManpowerLine[]> {
  const { officeRoots } = await import("@/lib/desk-service");
  const { unitBelongsToOffice } = await officeRoots();

  const [offices, posts, held] = await Promise.all([
    prisma.office.findMany({ select: { id: true, nameEn: true }, orderBy: { id: "asc" } }),
    prisma.orgPost.findMany({
      where: { isActive: true },
      select: { id: true, unitId: true, sanctionedCount: true, isSanctioned: true },
    }),
    prisma.employeeDesk.findMany({
      where: { releasedAt: null, kind: "substantive", employee: { status: { not: "retired" } } },
      select: { orgPostId: true, employee: { select: { officeId: true } } },
    }),
  ]);

  const postById = new Map(posts.map((p) => [p.id, p]));

  return offices.map((o) => {
    const mine = posts.filter((p) => unitBelongsToOffice(p.unitId, o.id));
    const sanctioned = mine.filter((p) => p.isSanctioned);
    const people = held.filter((h) => h.employee.officeId === o.id);
    const outside = people.filter((h) => postById.get(h.orgPostId)?.isSanctioned === false);
    const sanctionedSeats = sanctioned.reduce((n, p) => n + p.sanctionedCount, 0);
    return {
      officeId: o.id,
      officeName: o.nameEn,
      sanctionedPosts: sanctioned.length,
      sanctionedSeats,
      posted: people.length,
      postedOutside: outside.length,
      temporaryDesks: mine.length - sanctioned.length,
      overStrength: Math.max(0, people.length - sanctionedSeats),
    };
  });
}
