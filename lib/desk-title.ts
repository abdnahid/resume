/**
 * What job title to show for a person, and which rank a desk groups under.
 *
 * **Neither is a fact about a file moving**, which is why they no longer live
 * in `lib/workflow/chain.ts`: they are facts about an employee and the post
 * they sit on. The laboratory ladder needs the same rules (D143) and
 * `lib/labs/` deliberately imports nothing from `lib/workflow/`, so the rules
 * moved to where both can reach them rather than the boundary being crossed.
 *
 * Prisma-free (D9) — pure string rules over what a caller has already read.
 */

/**
 * The rank a desk is grouped under in a picker — Director, Deputy Director,
 * Assistant Director, Field Officer and so on.
 *
 * **Grade cannot do this on its own.** Assistant Director, Inspector, Examiner,
 * Field Officer and Senior Examiner are *all* grade 9, so a list ordered by
 * grade alone puts 82 Assistant Directors and 56 Field Officers in one
 * undifferentiated run. The designation is what separates them.
 *
 * Matched most specific first, and in both languages, because the roster holds
 * both: "সহকারী পরিচালক" contains "পরিচালক", and "Deputy Director" contains
 * "Director", so testing the shorter one first would file every deputy under
 * Director. The parenthetical is ignored — "Assistant Director (CM)" and
 * "Assistant Director (Metrology)" are the same rank on a picker.
 */
/** Ordered most senior first. The first pattern that matches wins. */
const RANK_TABLE: { label: string; order: number; patterns: string[] }[] = [
  { label: "Head of Office", order: 0, patterns: ["head of office", "অফিস প্রধান"] },
  // **Deputy before Director, and no special row for the wings' Directors.**
  // There used to be one — `["director (physics)", "director (chemistry)"]` at
  // this position — carrying the *same* label and order as the generic Director
  // row below, so it decided nothing it did not also break: "Deputy Director
  // (Chemistry)" contains "director (chemistry)", so it matched here and two
  // Deputy Directors of the testing wings ranked as **Directors**. In the
  // laboratory ladder that is the wing_head rung (D143) — the desk that
  // approves a test report — reached by a title that says deputy on its face.
  { label: "Deputy Director", order: 20, patterns: ["deputy director", "উপপরিচালক"] },
  { label: "Assistant Director", order: 30, patterns: ["assistant director", "সহকারী পরিচালক"] },
  { label: "Director", order: 10, patterns: ["director", "পরিচালক"] },
  { label: "Senior Examiner", order: 40, patterns: ["senior examiner", "ঊর্ধ্বতন পরীক্ষক", "উর্ধ্বতন পরীক্ষক"] },
  { label: "Senior Inspector", order: 41, patterns: ["senior inspector", "ঊর্ধ্বতন পরিদর্শক"] },
  { label: "Field Officer", order: 50, patterns: ["field officer", "ফিল্ড অফিসার"] },
  { label: "Examiner", order: 60, patterns: ["examiner", "পরীক্ষক"] },
  { label: "Inspector", order: 61, patterns: ["inspector", "পরিদর্শক"] },
];

export type DeskRank = { label: string; order: number };

export function deskRank(designation: string | null): DeskRank {
  const d = (designation ?? "").toLowerCase().trim();
  if (!d) return { label: "Other", order: 900 };
  for (const r of RANK_TABLE) if (r.patterns.some((pat) => d.includes(pat))) return r;
  // Not one of the chain's ranks — a Programmer, a Store Officer. Kept under
  // its own name rather than lumped into "Other", because it is a real desk.
  const pretty = (designation ?? "").trim();
  return { label: pretty.charAt(0).toUpperCase() + pretty.slice(1), order: 800 };
}

/**
 * The job title to show for a person: their desk's, where the desk is credible.
 *
 * **The post is the job** — a Deputy Director (CM) moved onto the Deputy
 * Director (Halal Certification) desk is doing the Halal job, and the roster's
 * `designation` column still says CM. So the desk's title wins, and that is
 * what this returns for the 43 people in exactly that position.
 *
 * **But two thirds of desks were inferred, not recorded.** `import:desks`
 * matches office → wing → grade → title and seats people on whatever post at
 * their grade is free when the title does not match, so 325 of 481 desked staff
 * sit on a post of a different *rank* from their recorded designation — 248
 * apparently promoted (a Field Officer on an Assistant Director desk, an Office
 * Assistant on a Security Guard desk) and 77 apparently demoted. Showing those
 * people the desk's title would tell them their job is something it is not, on
 * their own screen.
 *
 * So the rule is: **take the desk's title when it agrees in rank with what HR
 * recorded, and fall back to the recorded designation when it does not.** A
 * disagreement in rank is the signal that the seat was a guess. When the
 * organogram placement is corrected the fallback stops firing by itself.
 *
 * **A post held in additional charge is exempt**, and has to be. There the rank
 * difference *is* the fact — a Deputy Director acting as Director differs by a
 * rank on purpose — and the charge was recorded by hand rather than matched, so
 * there is nothing to distrust. Applying the fallback there would show the
 * officer running a wing the title he holds when he is not running it.
 *
 * This is display only. Seniority still follows the *person* — see
 * `seniority()` — for the same reason the pay grade does.
 */
export function displayDesignation(
  recorded: string | null,
  postTitle: string | null,
  isActing = false,
  /**
   * True while nobody has confirmed the seat — see
   * `Employee.orgPostIsInferred`. Defaults to trusting the post, because a
   * caller that does not know is describing a placement somebody made.
   */
  isInferred = false,
): string | null {
  if (!postTitle) return recorded;
  if (!recorded || isActing) return postTitle;
  // **A confirmed placement is the job, whatever the rank.** An Inspector
  // (Metrology) put on an Examiner (Chemical) desk because he knows chemistry
  // is doing the chemical job, and his files go to that section (D124).
  if (!isInferred) return postTitle;
  // Still inferred: the seat came from `import:desks` matching on grade, and a
  // rank disagreement is more likely to be the matching than the truth.
  return deskRank(recorded).label === deskRank(postTitle).label ? postTitle : recorded;
}
