/**
 * Who may hand a file to whom.
 *
 * Prisma-free (D9) so the desk picker and the route share one rule.
 *
 * **Seniority is the post's grade, not the org tree's depth.** The organogram
 * puts a branch Director in the office's Executive unit alongside their
 * stenographer and driver, while the DD, AD and Field Officer sit in sibling
 * units of the same wing or branch. So depth says nothing useful, and the
 * national pay grade — where a *lower* number is more senior — says exactly
 * what is needed: a Director is grade 5, a DD 6, an AD 9, an FO 10 or below.
 *
 * That is also why office head is a role rather than a designation: when the
 * senior desk is vacant a more junior officer acts in it, and their grade still
 * orders everyone beneath them correctly.
 */

export type Desk = {
  employeeId: string;
  name: string;
  /**
   * What this desk ranks as. Where an officer holds additional charge of a
   * vacant senior post this is that post's title, not their own — the charge is
   * what decides where they sit in the chain. `actingAs` carries it separately
   * so a picker can say so out loud rather than silently promoting somebody.
   */
  designation: string | null;
  /** The post held in additional charge, if any. Display only. */
  actingAs?: string | null;
  /** National pay grade of the post held. Lower is more senior. */
  grade: number | null;
  /** The wing or branch subtree this desk sits in. */
  sectionUnitId: number | null;
  /**
   * Still serving. A retired or inactive officer may not be handed a file.
   *
   * Office scoping is `employeesOfOffice()`, which asks where somebody works and
   * not whether they still do — it is payroll's rule, borrowed. So without this
   * a retiree who still held a desk stayed in the picker. It is checked on the
   * *candidate* only, never the sender: if a file is already in a retired
   * officer's hands it still has to be possible to move it out of them.
   */
  isActive: boolean;
};

export type Direction = "down" | "up";

/**
 * Grades sort as numbers, and an absent grade sorts last.
 *
 * A missing grade means no current posting, or a post with none recorded. Such
 * a desk can still *receive* a file — someone has to be able to hand work to a
 * newly posted officer — but never counts as senior to anybody, so it can never
 * be the target of a file sent upward.
 */
export function rank(grade: number | null): number {
  return grade ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Seniority as a pair: the pay grade first, then the rank of the designation
 * *within* that grade. Lower is more senior in both.
 *
 * **The grade alone is not an order.** Assistant Director, Field Officer,
 * Examiner, Inspector and Senior Examiner are all on grade 9, and at head
 * office 16 of the CM wing's 22 desks sit in that one band — 6 Assistant
 * Directors and 10 Field Officers. By grade they are all peers, so an AD could
 * not hand work to a Field Officer at all, which is the first step of the
 * processing chain the spec describes: office head → AD (CM) → FO (CM).
 *
 * So a tie on grade is broken by `deskRank()`, the same table the picker groups
 * by. It already encodes the real order — that is what it was written for — and
 * using it here means the two can never disagree about who is senior to whom.
 *
 * Peers are still peers: two Assistant Directors on grade 9 tie on *both*
 * halves, and a file may not move between them.
 */
export function seniority(d: Desk): [number, number] {
  return [rank(d.grade), deskRank(d.designation).order];
}

/** Is `a` strictly junior to `b`? */
function isJuniorTo(a: Desk, b: Desk): boolean {
  const [ag, ao] = seniority(a);
  const [bg, bo] = seniority(b);
  return ag !== bg ? ag > bg : ao > bo;
}

/**
 * May `sender` hand the file to `candidate` in this direction?
 *
 * Same section, and strictly the right side of the sender by seniority.
 * "Strictly" matters: two officers of the same rank are peers, and letting a
 * file move sideways would make "who holds it" a question of who clicked first,
 * with no way to read the chain back afterwards.
 */
export function canPassTo(sender: Desk, candidate: Desk, direction: Direction): boolean {
  if (candidate.employeeId === sender.employeeId) return false;
  if (!candidate.isActive) return false;
  if (sender.sectionUnitId === null || candidate.sectionUnitId === null) return false;
  if (candidate.sectionUnitId !== sender.sectionUnitId) return false;

  return direction === "down"
    ? isJuniorTo(candidate, sender)
    : isJuniorTo(sender, candidate);
}

/** The desks a sender may choose from, most senior first. */
export function eligibleDesks(sender: Desk, all: Desk[], direction: Direction): Desk[] {
  return all
    .filter((d) => canPassTo(sender, d, direction))
    .sort((a, b) => {
      const [ag, ao] = seniority(a);
      const [bg, bo] = seniority(b);
      return ag - bg || ao - bo || a.name.localeCompare(b.name);
    });
}

/** How a movement reads in the file's history. */
export function describeMovement(m: {
  direction: string;
  fromName: string | null;
  toName: string;
}): string {
  if (m.direction === "receive") return `Received by ${m.toName}`;
  // A reassignment names who was holding it, never who "sent" it — nobody did.
  if (m.direction === "reassign") {
    return m.fromName
      ? `Reassigned to ${m.toName}, from ${m.fromName}`
      : `Reassigned to ${m.toName}`;
  }
  const verb = m.direction === "down" ? "Passed down to" : "Sent up to";
  return m.fromName ? `${verb} ${m.toName}, by ${m.fromName}` : `${verb} ${m.toName}`;
}

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
  { label: "Director", order: 10, patterns: ["director (physics)", "director (chemistry)"] },
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
 * Desks grouped by rank for a picker, seniority first, and by grade then name
 * within each group. Prisma-free so the panel can call it.
 */
export function groupByRank(desks: Desk[]): { label: string; desks: Desk[] }[] {
  const groups = new Map<string, { order: number; desks: Desk[] }>();
  for (const d of desks) {
    const r = deskRank(d.designation);
    if (!groups.has(r.label)) groups.set(r.label, { order: r.order, desks: [] });
    groups.get(r.label)!.desks.push(d);
  }
  return [...groups]
    .sort((a, b) => a[1].order - b[1].order || a[0].localeCompare(b[0]))
    .map(([label, g]) => ({
      label,
      desks: g.desks.sort((a, b) => rank(a.grade) - rank(b.grade) || a.name.localeCompare(b.name)),
    }));
}
