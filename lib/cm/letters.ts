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
import { memoOfficeLabel } from "@/lib/bengali";

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
      officeId: true,
      office: { select: { nameEn: true } },
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
    if (b.officeId === null) continue; // a box with no destination cannot be addressed
    // A box goes to an office. Where that office holds a testing wing, the
    // letter is addressed to the wing head who will run or arrange the work
    // (D94); a branch has no wing, so its office head receives it — which is
    // what `office_head` already means.
    const labs = await prisma.lab.findMany({
      where: { officeId: b.officeId, isActive: true },
      select: { id: true },
    });
    let wing = null as Awaited<ReturnType<typeof wingHeadForLab>>;
    for (const l of labs) {
      wing = await wingHeadForLab(l.id);
      if (wing && wing.kind !== "vacant") break;
    }
    let recipient = wing;
    if (!wing || wing.kind === "vacant") {
      const head = await officeHeadFor(b.officeId);
      if (head) {
        out.push({
          labId: b.officeId,
          labName: b.office?.nameEn ?? "—",
          officeId: b.officeId,
          boxCode: b.code,
          recipient: { kind: "office_head", ...head },
        });
        continue;
      }
    }
    out.push({
      labId: b.officeId,
      labName: b.office?.nameEn ?? "—",
      officeId: b.officeId,
      boxCode: b.code,
      recipient,
    });
  }
  return out;
}

// ─── Issuing (D95) ──────────────────────────────────────────────────────────

/**
 * The letters this file needs, worked out from the sealed boxes.
 *
 * Derived rather than composed: one to each destination laboratory's wing head,
 * one to the applicant covering every box, and one to each office whose One Stop
 * counter will receive one. The officer cannot forget a laboratory, for the same
 * reason he cannot forget a destination (D69).
 *
 * `blockedBy` names anything that stops the set being issued. It is a list
 * rather than a throw so he sees every obstacle at once — an unaddressed wing is
 * fixed by an administrator, and finding that out one letter at a time is two
 * days instead of one.
 */
export async function plannedLettersFor(applicationId: number) {
  const recipients = await letterRecipientsFor(applicationId);
  const issued = await prisma.sampleLetter.findMany({
    where: { applicationId },
    select: { id: true, kind: true, labId: true, letterNo: true, issuedAt: true,
              addressedTo: { select: { nameEn: true } }, office: { select: { nameEn: true } },
              lab: { select: { nameEn: true } } },
    orderBy: { id: "asc" },
  });

  const offices = [...new Set(recipients.map((r) => r.officeId))];
  const officeRows = await prisma.office.findMany({
    where: { id: { in: offices } },
    select: { id: true, nameEn: true },
  });
  const officeName = new Map(officeRows.map((o) => [o.id, o.nameEn]));

  const blockedBy: string[] = [];
  if (recipients.length === 0) blockedBy.push("No samples have been sealed for this visit.");
  for (const r of recipients) {
    if (!r.recipient || r.recipient.kind === "vacant") {
      blockedBy.push(
        `${r.labName} has no one to address: ${
          r.recipient && r.recipient.kind === "vacant"
            ? `${r.recipient.postTitle ?? "the Director post"} in ${r.recipient.wingName} is vacant and nobody holds its charge`
            : "no wing head and no office head"
        }.`,
      );
    }
  }

  return {
    issued,
    blockedBy,
    planned: [
      ...recipients.map((r) => ({
        kind: "wing_head" as const,
        labId: r.labId,
        labName: r.labName,
        officeId: r.officeId,
        to:
          r.recipient && r.recipient.kind !== "vacant"
            ? `${r.recipient.name}${r.recipient.designation ? `, ${r.recipient.designation}` : ""}`
            : null,
      })),
      {
        kind: "applicant" as const,
        labId: null,
        labName: null,
        officeId: null,
        to: "the applicant — where to carry each sealed box",
      },
      ...offices.map((id) => ({
        kind: "one_stop" as const,
        labId: null,
        labName: null,
        officeId: id,
        to: `One Stop counter, ${officeName.get(id) ?? `office ${id}`}`,
      })),
    ],
  };
}

/**
 * Issue them — all of them, in one act.
 *
 * **All or none**, because a partial dispatch means a laboratory expecting a box
 * the applicant was never told to carry. Refused if anything is unaddressed, and
 * refused a second time: a letter already sent cannot be sent again, and a
 * corrected one is a fresh letter with its own number.
 *
 * The visiting officer issues, not the approving desk: approval says the visit
 * is sound, and these letters describe *his* samples, in his name. He is holding
 * the file when they go out, because approval hands it straight back to him
 * (D92).
 */
export async function issueSampleLetters(args: {
  applicationId: number;
  employeeId: string;
}) {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: args.applicationId },
    select: { holderEmployeeId: true, bstiOfficeId: true, inspectionReport: { select: { approvedAt: true } } },
  });
  if (app.holderEmployeeId !== args.employeeId) {
    throw new Error("Only whoever is holding this file can issue its letters.");
  }
  if (!app.inspectionReport?.approvedAt) {
    throw new Error("The visit has to be approved before its letters can go out.");
  }

  const existing = await prisma.sampleLetter.count({ where: { applicationId: args.applicationId } });
  if (existing > 0) throw new Error("The letters for this visit have already been issued.");

  const { planned, blockedBy } = await plannedLettersFor(args.applicationId);
  if (blockedBy.length) throw new Error(blockedBy.join(" "));

  const recipients = await letterRecipientsFor(args.applicationId);
  const byLab = new Map(recipients.map((r) => [r.labId, r]));

  // One serial run for the whole set, so a single dispatch's numbers are
  // consecutive and a gap means a letter that was never issued.
  const { prefix, suffix, from } = await nextLetterSerial(app.bstiOfficeId);
  let n = from;
  const rows = planned.map((p) => {
    const r = p.labId !== null ? byLab.get(p.labId) : null;
    return {
      applicationId: args.applicationId,
      kind: p.kind,
      labId: p.labId,
      officeId: p.kind === "one_stop" ? p.officeId : null,
      addressedToEmployeeId:
        p.kind === "wing_head" && r?.recipient && r.recipient.kind !== "vacant"
          ? r.recipient.employeeId
          : null,
      letterNo: `${prefix}${String(n++).padStart(4, "0")}${suffix}`,
      issuedByEmployeeId: args.employeeId,
    };
  });

  await prisma.sampleLetter.createMany({ data: rows });
  return rows.length;
}

/**
 * Where this office's letter numbers continue from.
 *
 * Returns the memo's two halves and the next serial, so the caller can number a
 * whole dispatch consecutively rather than asking once per letter and racing
 * itself. ASCII digits stored, Bengali at render, as everywhere else (D85).
 */
async function nextLetterSerial(officeId: number | null) {
  const year = new Date().getFullYear();
  const office = officeId
    ? await prisma.office.findUnique({ where: { id: officeId }, select: { nameBn: true } })
    : null;
  const label = office?.nameBn ? memoOfficeLabel(office.nameBn) : "ঢাকা";
  const prefix = `বিএসটিআই/${label}/নমুনা/`;
  const suffix = `/${year}`;
  const rows = await prisma.sampleLetter.findMany({
    where: { letterNo: { startsWith: prefix, endsWith: suffix } },
    select: { letterNo: true },
  });
  const highest = rows.reduce((max, r) => {
    const n = Number(r.letterNo.slice(prefix.length, r.letterNo.length - suffix.length));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return { prefix, suffix, from: highest + 1 };
}
