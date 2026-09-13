/**
 * Seating a person on an organogram post — the server half.
 *
 * **Why a screen exists at all.** Every desk held today was assigned by a
 * script. `import:desks` matches office → wing → grade → title, and where no
 * title matches it takes whatever seat at the grade is free — so a placement it
 * makes is a guess, and `Employee.orgPostIsInferred` says so. 322 of the 480
 * seats are guesses, and **every one of them disagrees in rank** with what HR
 * recorded, which is why `displayDesignation()` falls back to the recorded
 * title for all of them. Nothing could clear the flag until this file existed:
 * the importer only ever *fills* a null `orgPostId`, so a wrong seat was
 * permanent.
 *
 * The desk decides which section a file routes to (D58) and which title a
 * person is shown (D124), so this is not cosmetic tidying.
 *
 * **Two columns, on purpose** (D74). `orgPostId` is the post somebody holds
 * substantively; `actingOrgPostId` is a post held in *additional charge*, which
 * is what a wing whose Director post is vacant runs on. `toDesk()` reads the
 * acting post first — acting means exercising that post's authority and not
 * your own — so ending a charge is nulling one field and the substantive seat
 * is still there underneath.
 */
import { prisma } from "@/lib/prisma";

/** The organogram writes Barisal; the office register writes Barishal. */
const CITY_ALIASES: Record<string, string> = { barishal: "barisal" };

export type PostOption = {
  id: number;
  nameEn: string;
  nameBn: string | null;
  grade: string | null;
  unitId: number;
  unitEn: string;
  unitBn: string | null;
  sanctioned: number;
  held: number;
  /** Who is on it now — named rather than counted, so a swap can be planned. */
  holders: { id: string; nameEn: string }[];
};

/**
 * Which organogram root belongs to which office.
 *
 * Head office is not one subtree but *all the wings*, so its entry is `null`
 * and is read as "any root whose category is `wing`". A branch office is
 * matched to the root named for its city. Lifted out of `import:desks`, which
 * had the only copy.
 */
export async function officeRoots() {
  const [units, offices] = await Promise.all([
    prisma.orgUnit.findMany({ select: { id: true, nameEn: true, parentId: true, category: true } }),
    prisma.office.findMany({ select: { id: true, nameEn: true, type: true } }),
  ]);
  const byId = new Map(units.map((u) => [u.id, u]));
  const roots = units.filter((u) => u.parentId === null);

  const rootFor = new Map<number, number | null>();
  for (const o of offices) {
    if (o.type === "head") {
      rootFor.set(o.id, null);
      continue;
    }
    if (o.type === "dmi") {
      rootFor.set(o.id, roots.find((r) => r.nameEn.includes("DMI"))?.id ?? null);
      continue;
    }
    const city0 = o.nameEn.split(",").pop()!.trim().toLowerCase();
    const city = CITY_ALIASES[city0] ?? city0;
    rootFor.set(o.id, roots.find((r) => r.nameEn.toLowerCase() === city)?.id ?? null);
  }

  const rootOfUnit = (id: number): number => {
    let c = id;
    while (byId.get(c)!.parentId != null) c = byId.get(c)!.parentId!;
    return c;
  };

  /**
   * Is this unit inside this office's own subtree? A post outside it is
   * unreachable by that office's routing — a file sent to the office would
   * arrive at a desk in somebody else's — which is why `import:desks` releases
   * such a seat rather than keeping it.
   */
  const unitBelongsToOffice = (unitId: number, officeId: number) => {
    const want = rootFor.get(officeId);
    if (want === undefined) return false;
    const got = rootOfUnit(unitId);
    return want === null ? byId.get(got)?.category === "wing" : got === want;
  };

  return { units, byId, roots, rootFor, rootOfUnit, unitBelongsToOffice };
}

/**
 * Every post an employee of this office could be seated on, with who is on it.
 *
 * Occupancy travels with the option because 54 posts are already over their
 * sanctioned count from the original seeding, so "is there room" is a real
 * question and the answer has to be visible *before* the choice, not after.
 */
export async function postsForOffice(officeId: number): Promise<PostOption[]> {
  const { unitBelongsToOffice } = await officeRoots();
  const posts = await prisma.orgPost.findMany({
    where: { isActive: true },
    select: {
      id: true,
      nameEn: true,
      nameBn: true,
      grade: true,
      sanctionedCount: true,
      unitId: true,
      unit: { select: { nameEn: true, nameBn: true } },
      employees: {
        where: { status: "active" },
        select: { id: true, nameEn: true },
        orderBy: { id: "asc" },
      },
    },
    orderBy: [{ grade: "asc" }, { nameEn: "asc" }],
  });

  return posts
    .filter((p) => unitBelongsToOffice(p.unitId, officeId))
    .map((p) => ({
      id: p.id,
      nameEn: p.nameEn,
      nameBn: p.nameBn,
      grade: p.grade,
      unitId: p.unitId,
      unitEn: p.unit.nameEn,
      unitBn: p.unit.nameBn,
      sanctioned: p.sanctionedCount,
      held: p.employees.length,
      holders: p.employees,
    }));
}

export type SetDeskArgs = {
  employeeId: string;
  /** `undefined` leaves it alone; `null` releases the seat. */
  orgPostId?: number | null;
  /** `undefined` leaves it alone; `null` ends the additional charge. */
  actingOrgPostId?: number | null;
  /** Seat them even though the post is at or over its sanctioned count. */
  allowOverfill?: boolean;
};

export type SetDeskResult = {
  employeeId: string;
  name: string;
  post: { id: number; nameEn: string; unitEn: string; grade: string | null } | null;
  acting: { id: number; nameEn: string; unitEn: string; grade: string | null } | null;
  /** Things the administrator should know but which do not refuse the write. */
  warnings: string[];
};

/**
 * Seat somebody, or release them.
 *
 * **Confirming a seat clears `orgPostIsInferred`**, and that is the point of
 * the screen: the flag means "a script guessed this", so a human choosing the
 * post is exactly the thing that makes it untrue. `displayDesignation()` then
 * trusts the post outright and the person's title becomes their desk's — which
 * is the rule that desks and designations share one naming system.
 *
 * **Over-capacity is refused by name, not by count** — the same discipline as
 * `setRouting()`. The fix for a full post is to move whoever is on it, and a
 * number does not say who that is. It can be overridden deliberately, because
 * 54 posts are already over their sanctioned count and those rows must stay
 * editable.
 */
export async function setDesk(args: SetDeskArgs): Promise<SetDeskResult> {
  const e = await prisma.employee.findUnique({
    where: { id: args.employeeId },
    select: {
      id: true,
      nameEn: true,
      status: true,
      officeId: true,
      grade: true,
      orgPostId: true,
      actingOrgPostId: true,
    },
  });
  if (!e) throw new Error("No such employee.");

  const warnings: string[] = [];
  const { unitBelongsToOffice } = await officeRoots();

  const load = async (id: number) => {
    const p = await prisma.orgPost.findUnique({
      where: { id },
      select: {
        id: true,
        nameEn: true,
        grade: true,
        isActive: true,
        sanctionedCount: true,
        unitId: true,
        unit: { select: { nameEn: true } },
        employees: {
          where: { status: "active", id: { not: args.employeeId } },
          select: { id: true, nameEn: true },
        },
      },
    });
    if (!p) throw new Error(`Post ${id} does not exist.`);
    if (!p.isActive) throw new Error(`${p.nameEn} is not an active post.`);
    // A post outside the office's own subtree makes the holder unreachable by
    // that office's routing — the fault `import:desks` releases seats to fix.
    if (!unitBelongsToOffice(p.unitId, e.officeId)) {
      throw new Error(
        `${p.nameEn} sits in ${p.unit.nameEn}, which is not in this employee's office. ` +
          `A file routed to their office would arrive at a desk in another one.`,
      );
    }
    return p;
  };

  let postId = e.orgPostId;
  let actingId = e.actingOrgPostId;

  if (args.orgPostId !== undefined) {
    if (args.orgPostId === null) {
      postId = null;
    } else {
      const p = await load(args.orgPostId);
      const over = p.employees.length + 1 > p.sanctionedCount;
      if (over && !args.allowOverfill) {
        throw new Error(
          `${p.nameEn} in ${p.unit.nameEn} is sanctioned for ${p.sanctionedCount} and is held by ` +
            `${p.employees.map((h) => `${h.nameEn} (${h.id})`).join(", ")}. ` +
            `Move them first, or seat this person anyway.`,
        );
      }
      if (over) {
        warnings.push(`${p.nameEn} is now over its sanctioned count of ${p.sanctionedCount}.`);
      }
      if (e.grade && p.grade && e.grade !== p.grade) {
        // Not an error: seniority follows the *person*, and a real placement
        // may cross grades (D124). Worth saying out loud all the same.
        warnings.push(
          `Grade ${e.grade} officer on a grade ${p.grade} post — seniority still follows the person.`,
        );
      }
      postId = p.id;
    }
  }

  if (args.actingOrgPostId !== undefined) {
    if (args.actingOrgPostId === null) {
      actingId = null;
    } else {
      const p = await load(args.actingOrgPostId);
      if (p.id === postId) {
        throw new Error(
          `${p.nameEn} is already their substantive post. Additional charge is a second post.`,
        );
      }
      if (p.employees.length) {
        // Additional charge is what a vacant post runs on (D74). A charge over
        // an occupied one is a real arrangement — somebody on leave — but it is
        // unusual enough to say so.
        warnings.push(
          `${p.nameEn} is held substantively by ${p.employees.map((h) => h.nameEn).join(", ")}. ` +
            `Additional charge normally covers a vacant post.`,
        );
      }
      actingId = p.id;
    }
  }

  const updated = await prisma.employee.update({
    where: { id: args.employeeId },
    data: {
      orgPostId: postId,
      actingOrgPostId: actingId,
      // **A human chose it, so it is no longer a guess.** Releasing a seat
      // leaves nothing to be inferred about either.
      orgPostIsInferred: false,
    },
    select: {
      id: true,
      nameEn: true,
      orgPost: {
        select: { id: true, nameEn: true, grade: true, unit: { select: { nameEn: true } } },
      },
      actingOrgPost: {
        select: { id: true, nameEn: true, grade: true, unit: { select: { nameEn: true } } },
      },
    },
  });

  if (!postId && !actingId) {
    warnings.push(
      "They now hold no desk, so they have no section and no file can be passed to them.",
    );
  }

  return {
    employeeId: updated.id,
    name: updated.nameEn,
    post: updated.orgPost
      ? {
          id: updated.orgPost.id,
          nameEn: updated.orgPost.nameEn,
          unitEn: updated.orgPost.unit.nameEn,
          grade: updated.orgPost.grade,
        }
      : null,
    acting: updated.actingOrgPost
      ? {
          id: updated.actingOrgPost.id,
          nameEn: updated.actingOrgPost.nameEn,
          unitEn: updated.actingOrgPost.unit.nameEn,
          grade: updated.actingOrgPost.grade,
        }
      : null,
    warnings,
  };
}
