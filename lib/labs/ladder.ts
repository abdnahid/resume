/**
 * The laboratory's own chain of desks — the Prisma-free half (D9).
 *
 * **This is not the CM chain, and must not be built as one.** The client was
 * explicit (2026-09-07): a file moves through the institution by seniority,
 * while a laboratory runs four fixed rungs inside one wing. So the rungs are
 * their own scale rather than `deskRank()`, and the unit that moves is the
 * `LabTestOrder` — which by D70 carries no application column at all.
 *
 *     wing head → deputy director → assistant director → examiner
 *
 * **An office missing a rung skips it**, which is the normal case rather than
 * the exception: eleven offices have only grade 9 in their CM section at all,
 * and a branch laboratory is often one Examiner. The ladder therefore never
 * asks "who is the Deputy Director" — it asks who exists, and goes to the next
 * one down that does.
 */

export type LabRung = "wing_head" | "deputy_director" | "assistant_director" | "examiner";

/** Top first. Index in this array *is* the rung's seniority. */
export const LAB_RUNGS: readonly LabRung[] = [
  "wing_head",
  "deputy_director",
  "assistant_director",
  "examiner",
];

export const RUNG_LABELS: Record<LabRung, string> = {
  wing_head: "Wing head",
  deputy_director: "Deputy Director",
  assistant_director: "Assistant Director",
  examiner: "Examiner",
};

/**
 * Which rung a title sits on, or null for a desk that is not on the ladder at
 * all — a Lab Assistant, a Stenographer, an Office Assistant.
 *
 * Matched on the title rather than the grade because a wing's posts are named
 * for their discipline, not their rank in this ladder: *Senior Inspector
 * (Chemistry)* and *Inspector (Chemistry)* are both benches, and both sit at
 * grade 9 beside an *Assistant Director (Chemistry)* who supervises them.
 * Grade alone cannot separate those three, which is the same fault D78 had to
 * fix on the CM side.
 */
export function rungOf(title: string | null | undefined): LabRung | null {
  const t = (title ?? "").toLowerCase();
  if (!t) return null;
  // Director first: "Deputy Director" contains "director", so the more specific
  // test has to come before the looser one or every DD reads as a wing head.
  if (t.includes("deputy director") || t.includes("উপপরিচালক")) return "deputy_director";
  if (t.includes("assistant director") || t.includes("সহকারী পরিচালক")) return "assistant_director";
  if (t.includes("director") || t.includes("পরিচালক")) return "wing_head";
  if (
    t.includes("examiner") ||
    t.includes("inspector") ||
    t.includes("পরীক্ষক") ||
    t.includes("পরিদর্শক")
  ) {
    return "examiner";
  }
  return null;
}

/** Is `a` senior to `b` on this ladder? */
export function isAbove(a: LabRung, b: LabRung): boolean {
  return LAB_RUNGS.indexOf(a) < LAB_RUNGS.indexOf(b);
}

/**
 * The next rung below `from` that this office actually staffs.
 *
 * `available` is the set of rungs with at least one serving person on them, so
 * a wing with no Deputy Director hands straight to its Assistant Director, and
 * one with neither hands straight to the bench.
 */
export function nextRungBelow(from: LabRung, available: readonly LabRung[]): LabRung | null {
  const start = LAB_RUNGS.indexOf(from);
  for (let i = start + 1; i < LAB_RUNGS.length; i++) {
    if (available.includes(LAB_RUNGS[i])) return LAB_RUNGS[i];
  }
  return null;
}

/**
 * Who signs a test report where, given the rungs this office staffs — the
 * client's rule, stated 2026-09-13.
 *
 * | staffed below the wing head | tested by | checked by | authorised by |
 * |---|---|---|---|
 * | Examiner + AD + DD | Examiner | AD | DD |
 * | Examiner + AD | Examiner | — | AD |
 * | Examiner only | Examiner | — | Examiner |
 *
 * The wing head always **approves**, and approving is deliberately not one of
 * these three: it is the act that turns a draft into a document, and it is the
 * only step the FDO's side ever learns about.
 *
 * **Nobody signs their own work.** Where the rung above the tester is empty the
 * **wing head** gives the authorising signature and approves in the same act —
 * the client's rule, 2026-09-14, overruling D133's original table, which had the
 * Examiner authorise his own report at a one-bench office. That was defended on
 * the grounds that the alternative is a report nobody can sign; the answer is
 * that there *is* somebody, and it is the officer who was going to approve it
 * anyway.
 *
 * **The wing head never appears as a signature where a rung below him can give
 * one.** Head office always staffs Director → DD → AD → Examiner, so its
 * reports are signed three rungs down and the Director only approves. At a
 * branch the office head is the wing head, and he signs only when there is not
 * even an Assistant Director beneath him.
 */
export type SignaturePlan = {
  testedBy: LabRung;
  checkedBy: LabRung | null;
  authorisedBy: LabRung;
};

export function signaturePlan(available: readonly LabRung[]): SignaturePlan {
  const hasDD = available.includes("deputy_director");
  const hasAD = available.includes("assistant_director");
  const hasEx = available.includes("examiner");

  // With no bench the Assistant Director tests as well — every Examiner *and*
  // every Assistant Director is a testing officer by the desk they hold.
  const tester: LabRung = hasEx ? "examiner" : hasAD ? "assistant_director" : "deputy_director";

  if (hasDD && hasAD && hasEx) {
    return { testedBy: "examiner", checkedBy: "assistant_director", authorisedBy: "deputy_director" };
  }
  // `tester !== "deputy_director"` is what stops a lone DD authorising himself:
  // with nobody below him he tests, and the signature has to come from above.
  if (hasDD && tester !== "deputy_director") {
    return { testedBy: tester, checkedBy: null, authorisedBy: "deputy_director" };
  }
  if (hasAD && hasEx) {
    return { testedBy: "examiner", checkedBy: null, authorisedBy: "assistant_director" };
  }
  // Nobody above the tester, so the wing head signs as well as approves.
  return { testedBy: tester, checkedBy: null, authorisedBy: "wing_head" };
}

/**
 * The order state that follows a testing officer submitting his results.
 *
 * Derived from the signature plan rather than hard-coded, so an office with no
 * Assistant Director never enters `pending_check` and nobody waits for a
 * signature that has no one to give it.
 */
export type LabOrderState =
  | "awaiting_sample"
  | "received"
  | "in_progress"
  | "pending_check"
  | "pending_authorisation"
  | "pending_approval"
  | "reported"
  | "cancelled";

export function stateAfterSubmit(plan: SignaturePlan): LabOrderState {
  if (plan.checkedBy) return "pending_check";
  // The wing head is the authoriser, and authorising and approving are one act
  // for him — so it goes straight to his desk rather than waiting at a rung
  // that has nobody on it.
  if (plan.authorisedBy === "wing_head") return "pending_approval";
  return "pending_authorisation";
}

export const ORDER_STATE_LABELS: Record<LabOrderState, string> = {
  awaiting_sample: "Awaiting sample",
  received: "Sample received by wing",
  in_progress: "Testing",
  pending_check: "Awaiting check",
  pending_authorisation: "Awaiting authorisation",
  pending_approval: "Awaiting wing head approval",
  reported: "Report approved",
  cancelled: "Cancelled",
};

export type Verdict = "pass" | "fail" | "inconclusive" | "not_tested";

/**
 * The report's overall verdict, and what stops it being submitted.
 *
 * **All pass → pass; one fail → fail.** A licence rests on the whole standard,
 * so a single failed parameter fails the report however many passed.
 *
 * **An untested or inconclusive parameter blocks submission, by name.** The
 * same shape as `reportGaps()` and `missingForSubmission()`: every gap at once,
 * so the officer fixes them in one sitting rather than meeting the next one
 * after each save.
 */
export function overallVerdict(
  lines: readonly { label: string; verdict: Verdict }[],
): { verdict: Verdict; gaps: string[] } {
  const gaps = lines
    .filter((l) => l.verdict === "not_tested" || l.verdict === "inconclusive")
    .map((l) => `${l.label} — ${l.verdict === "not_tested" ? "no result" : "inconclusive"}`);
  if (!lines.length) return { verdict: "not_tested", gaps: ["No parameters on this order."] };
  if (gaps.length) return { verdict: "not_tested", gaps };
  return { verdict: lines.some((l) => l.verdict === "fail") ? "fail" : "pass", gaps: [] };
}

/** One line of the desk flow, phrased the same way wherever it is rendered. */
export function describeLabMovement(m: {
  direction: string;
  fromName: string | null;
  toName: string;
  note: string | null;
}): string {
  const base =
    m.direction === "receive"
      ? `Samples received by ${m.toName}`
      : m.direction === "down"
        ? `${m.fromName ?? "—"} → ${m.toName}`
        : m.direction === "up"
          ? `${m.fromName ?? "—"} sent up to ${m.toName}`
          : `Reassigned to ${m.toName}`;
  return m.note ? `${base} — ${m.note}` : base;
}
