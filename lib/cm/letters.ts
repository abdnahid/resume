/**
 * Who the letters after an approved visit are addressed to (D94).
 *
 * **The wing head is whoever holds the wing's Director post — not the
 * seniormost officer of the section.** An earlier note in `CLAUDE.md` said the
 * latter, written before additional charge existed as a column (D74). The live
 * roster shows why it does not work: head office's Physical Testing Wing has
 * *two* grade-4 Directors in it, one holding the Director (Physics) post and
 * one sitting on a Deputy Director (Textile) post from the original seeding.
 * They tie on grade and they tie on designation rank, so "seniormost" picked
 * whichever the sort happened to return — which is not a way to address a
 * letter.
 *
 * So the post decides, in one order:
 *
 * 1. the officer holding the wing's Director post substantively;
 * 2. the officer holding it in **additional charge** (D74) — the client's rare
 *    case, and exactly what that column was added for;
 * 3. nobody, said out loud.
 *
 * **Refusing to guess is the point of step 3.** Head office's Chemical Testing
 * Wing has a vacant Director post and nobody acting in it today, so a
 * seniority rule would quietly address the letter to whichever Deputy Director
 * sorted first. An unaddressed letter is a problem someone fixes in a minute;
 * a letter addressed to the wrong officer is one nobody notices.
 */
import { prisma } from "@/lib/prisma";

export type WingHead =
  | {
      kind: "substantive" | "acting";
      employeeId: string;
      name: string;
      designation: string | null;
      postTitle: string;
      wingId: number;
      wingName: string;
    }
  | { kind: "vacant"; wingId: number; wingName: string; postTitle: string | null };

/** The wing a unit hangs under — the same walk `sectionRoots()` does. */
async function wingOf(orgUnitId: number) {
  const units = await prisma.orgUnit.findMany({
    select: { id: true, nameEn: true, parentId: true, category: true },
  });
  const byId = new Map(units.map((u) => [u.id, u]));
  let cur = byId.get(orgUnitId);
  const seen = new Set<number>();
  while (cur && cur.category !== "wing") {
    if (seen.has(cur.id)) break;
    seen.add(cur.id);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return cur && cur.category === "wing" ? { id: cur.id, nameEn: cur.nameEn } : null;
}

/**
 * The officer a sample letter for this laboratory is addressed to.
 *
 * At head office that is the testing wing's Director — Physical or Chemical,
 * decided by which wing the lab sits in, so a file whose parameters split
 * across both produces two letters and not one. At a branch office the labs sit
 * under the branch itself rather than under a testing wing, so there is no wing
 * Director and the office head is the addressee; `officeHeadFor()` answers that.
 */
export async function wingHeadForLab(labId: number): Promise<WingHead | null> {
  const lab = await prisma.lab.findUnique({
    where: { id: labId },
    select: { orgUnitId: true, officeId: true },
  });
  if (!lab) return null;

  // A branch lab may hang off no unit at all; there is no wing to find, and the
  // office head receives instead.
  if (lab.orgUnitId === null) return null;
  const wing = await wingOf(lab.orgUnitId);
  if (!wing) return null;

  // The wing's own Director post, in its Executive unit or the wing root.
  const post = await prisma.orgPost.findFirst({
    where: {
      nameEn: { startsWith: "Director" },
      NOT: { nameEn: "Director General" },
      unit: { OR: [{ id: wing.id }, { parentId: wing.id }] },
    },
    select: {
      nameEn: true,
      employees: {
        where: { status: "active" },
        select: { id: true, nameEn: true, designationEn: true, designationBn: true },
      },
      actingHolders: {
        where: { status: "active" },
        select: { id: true, nameEn: true, designationEn: true, designationBn: true },
      },
    },
  });
  if (!post) return { kind: "vacant", wingId: wing.id, wingName: wing.nameEn, postTitle: null };

  const substantive = post.employees[0];
  if (substantive) {
    return {
      kind: "substantive",
      employeeId: substantive.id,
      name: substantive.nameEn,
      designation: substantive.designationEn ?? substantive.designationBn,
      postTitle: post.nameEn,
      wingId: wing.id,
      wingName: wing.nameEn,
    };
  }

  // Nobody in post: the officer given its charge (D74). This is the rare case,
  // and it is a recorded fact rather than an inference from grades.
  const acting = post.actingHolders[0];
  if (acting) {
    return {
      kind: "acting",
      employeeId: acting.id,
      name: acting.nameEn,
      designation: acting.designationEn ?? acting.designationBn,
      postTitle: post.nameEn,
      wingId: wing.id,
      wingName: wing.nameEn,
    };
  }

  return { kind: "vacant", wingId: wing.id, wingName: wing.nameEn, postTitle: post.nameEn };
}

/**
 * The office head, for a branch office's laboratories.
 *
 * A branch has one flat Physical or Chemistry lab under the branch itself, not
 * under a testing wing, so there is no wing Director to write to and the office
 * head receives instead — which is what `office_head` already means (D57).
 */
export async function officeHeadFor(officeId: number) {
  const heads = await prisma.user.findMany({
    where: { role: "office_head" },
    select: { username: true },
  });
  const ids = heads.map((h) => h.username).filter((x): x is string => !!x);
  const rows = await prisma.employee.findMany({
    where: { id: { in: ids }, status: "active" },
    select: {
      id: true,
      nameEn: true,
      designationEn: true,
      designationBn: true,
      officeId: true,
      postings: { where: { relievedAt: null }, select: { officeId: true }, take: 1 },
    },
  });
  const mine = rows.find((r) => (r.postings[0]?.officeId ?? r.officeId) === officeId);
  return mine
    ? {
        employeeId: mine.id,
        name: mine.nameEn,
        designation: mine.designationEn ?? mine.designationBn,
      }
    : null;
}

/**
 * Every officer a letter goes to for one application's sealed boxes.
 *
 * One per destination laboratory, deduplicated by person: a file whose
 * parameters split across Physical and Chemical produces two letters, and one
 * whose two labs sit under the same wing produces one.
 */
export async function letterRecipientsFor(applicationId: number) {
  const boxes = await prisma.consignment.findMany({
    where: { applicationId },
    select: {
      id: true,
      code: true,
      labId: true,
      lab: { select: { nameEn: true, officeId: true, discipline: true } },
    },
    orderBy: { id: "asc" },
  });

  const out: {
    labId: number;
    labName: string;
    officeId: number;
    boxCode: string;
    recipient: WingHead | { kind: "office_head"; employeeId: string; name: string; designation: string | null } | null;
  }[] = [];

  for (const b of boxes) {
    const wing = await wingHeadForLab(b.labId);
    let recipient = wing;
    if (!wing || wing.kind === "vacant") {
      const head = await officeHeadFor(b.lab.officeId);
      if (head) {
        out.push({
          labId: b.labId,
          labName: b.lab.nameEn,
          officeId: b.lab.officeId,
          boxCode: b.code,
          recipient: { kind: "office_head", ...head },
        });
        continue;
      }
    }
    out.push({
      labId: b.labId,
      labName: b.lab.nameEn,
      officeId: b.lab.officeId,
      boxCode: b.code,
      recipient,
    });
  }
  return out;
}
