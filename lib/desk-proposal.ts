/**
 * Proposing who should sit on which organogram post — in bulk, for review.
 *
 * **Why bulk at all.** 249 active employees hold no post and 322 more sit on
 * one a script guessed, every one of those 322 disagreeing in rank with what HR
 * recorded. Correcting them through the per-person picker at
 * `/hr/listing/desks` is about 570 separate interactions, which is not a
 * workflow anybody completes. The client's call, 2026-09-20: propose in bulk,
 * apply after review.
 *
 * **Proposing is not applying, and this file never writes.** It reads the
 * roster and the chart and returns what it would do and why; the caller shows
 * the list and applies the rows an administrator ticks — each one through
 * `setDesk()`, so every rule that guards a single seat still guards a batch.
 * A batch that wrote through its own path would be a second set of rules.
 *
 * **Confidence is the whole output.** A proposal an administrator has to check
 * one at a time has saved him nothing, so each row says how it was reached:
 * `exact` where one vacant post in the person's own office matches their rank
 * *and* grade, `rank` where the grade differs, `ambiguous` where several posts
 * qualify and the choice is a judgement, `none` where the chart holds no post
 * of that rank at all. Only `exact` is ticked by default.
 */
import { prisma } from "@/lib/prisma";
import { deskRank } from "@/lib/desk-title";
import { officeRoots } from "@/lib/desk-service";

export type ProposalConfidence = "exact" | "rank" | "ambiguous" | "none";

export type DeskProposal = {
  employeeId: string;
  name: string;
  recorded: string | null;
  grade: string | null;
  officeId: number | null;
  officeName: string;
  /** What is wrong today: no seat at all, or a seat of the wrong rank. */
  problem: "unseated" | "rank_disagrees";
  current: { id: number; nameEn: string; unitEn: string } | null;
  confidence: ProposalConfidence;
  /** The single post proposed, where one stands out. */
  proposed: { id: number; nameEn: string; unitEn: string; grade: string | null } | null;
  /** Everything that qualified, so an ambiguous row can be resolved in place. */
  options: { id: number; nameEn: string; unitEn: string; grade: string | null; vacancies: number }[];
  /** Why this row reads the way it does, in one sentence. */
  reason: string;
};

export type ProposalSummary = {
  proposals: DeskProposal[];
  counts: Record<ProposalConfidence, number>;
  /** Ranks nobody can be seated at because the chart has no such post. */
  missingRanks: { rank: string; people: number }[];
};

/**
 * Work out a seat for everybody who needs one.
 *
 * `officeId` narrows it; omitted, the whole institution is proposed at once.
 */
export async function proposeDesks(officeId?: number): Promise<ProposalSummary> {
  const [employees, posts, { unitBelongsToOffice }] = await Promise.all([
    prisma.employee.findMany({
      where: { status: "active", ...(officeId ? { officeId } : {}) },
      select: {
        id: true,
        nameEn: true,
        designationEn: true,
        designationBn: true,
        grade: true,
        officeId: true,
        orgPostId: true,
        orgPostIsInferred: true,
        office: { select: { nameEn: true } },
        orgPost: { select: { id: true, nameEn: true, unit: { select: { nameEn: true } } } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.orgPost.findMany({
      where: { isActive: true },
      select: {
        id: true,
        nameEn: true,
        grade: true,
        sanctionedCount: true,
        unitId: true,
        unit: { select: { nameEn: true } },
        employees: { where: { status: "active" }, select: { id: true } },
      },
    }),
    officeRoots(),
  ]);

  // Vacancies are counted once, up front, and **decremented as the run
  // proposes** — otherwise two people at the same rank are both proposed the
  // same single free seat and the second write fails at apply time, after the
  // administrator has already approved it.
  const vacancy = new Map<number, number>();
  for (const p of posts) vacancy.set(p.id, p.sanctionedCount - p.employees.length);

  const proposals: DeskProposal[] = [];
  const missing = new Map<string, number>();

  for (const e of employees) {
    const recorded = e.designationEn ?? e.designationBn;
    const rank = deskRank(recorded).label;
    const currentRank = e.orgPost ? deskRank(e.orgPost.nameEn).label : null;

    // Only two populations need a proposal: nobody is being moved off a seat
    // that already agrees, and a *confirmed* seat is somebody's decision (D131)
    // and is never second-guessed by a batch.
    const problem: DeskProposal["problem"] | null = !e.orgPostId
      ? "unseated"
      : e.orgPostIsInferred && currentRank !== rank
        ? "rank_disagrees"
        : null;
    if (!problem) continue;

    const candidates = posts.filter(
      (p) =>
        deskRank(p.nameEn).label === rank &&
        unitBelongsToOffice(p.unitId, e.officeId) &&
        (vacancy.get(p.id) ?? 0) > 0,
    );

    const options = candidates.map((p) => ({
      id: p.id,
      nameEn: p.nameEn,
      unitEn: p.unit.nameEn,
      grade: p.grade,
      vacancies: vacancy.get(p.id) ?? 0,
    }));

    let confidence: ProposalConfidence;
    let proposed: DeskProposal["proposed"] = null;
    let reason: string;

    if (!candidates.length) {
      // Distinguish "the chart has no such post anywhere" from "this office's
      // are all full" — they are different problems with different fixes.
      const anywhere = posts.some((p) => deskRank(p.nameEn).label === rank);
      confidence = "none";
      reason = anywhere
        ? `Every ${rank} post in ${e.office?.nameEn ?? "this office"} is at its sanctioned count.`
        : `The organogram holds no post of rank ${rank}.`;
      if (!anywhere) missing.set(rank, (missing.get(rank) ?? 0) + 1);
    } else {
      const sameGrade = candidates.filter(
        (p) => e.grade && p.grade && String(p.grade) === String(e.grade),
      );
      const pool = sameGrade.length ? sameGrade : candidates;
      if (pool.length === 1) {
        const p = pool[0];
        proposed = { id: p.id, nameEn: p.nameEn, unitEn: p.unit.nameEn, grade: p.grade };
        confidence = sameGrade.length ? "exact" : "rank";
        reason = sameGrade.length
          ? `One vacant ${rank} post at grade ${e.grade} in their own office.`
          : `One vacant ${rank} post, but at grade ${p.grade ?? "—"} against their ${e.grade ?? "—"}.`;
      } else {
        confidence = "ambiguous";
        reason = `${pool.length} vacant ${rank} posts qualify — which section is a judgement.`;
      }
    }

    if (proposed) vacancy.set(proposed.id, (vacancy.get(proposed.id) ?? 1) - 1);

    proposals.push({
      employeeId: e.id,
      name: e.nameEn,
      recorded,
      grade: e.grade ? String(e.grade) : null,
      officeId: e.officeId,
      officeName: e.office?.nameEn ?? "—",
      problem,
      current: e.orgPost
        ? { id: e.orgPost.id, nameEn: e.orgPost.nameEn, unitEn: e.orgPost.unit.nameEn }
        : null,
      confidence,
      proposed,
      options,
      reason,
    });
  }

  const counts: Record<ProposalConfidence, number> = {
    exact: 0,
    rank: 0,
    ambiguous: 0,
    none: 0,
  };
  for (const p of proposals) counts[p.confidence]++;

  return {
    proposals,
    counts,
    missingRanks: [...missing.entries()]
      .map(([rank, people]) => ({ rank, people }))
      .sort((a, b) => b.people - a.people),
  };
}
