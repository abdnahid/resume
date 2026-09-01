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
  designation: string | null;
  /** National pay grade of the post held. Lower is more senior. */
  grade: number | null;
  /** The wing or branch subtree this desk sits in. */
  sectionUnitId: number | null;
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
 * May `sender` hand the file to `candidate` in this direction?
 *
 * Same section, and strictly the right side of the sender by grade. "Strictly"
 * matters: two officers on one grade are peers, and letting a file move
 * sideways would make "who holds it" a question of who clicked first, with no
 * way to read the chain back afterwards.
 */
export function canPassTo(sender: Desk, candidate: Desk, direction: Direction): boolean {
  if (candidate.employeeId === sender.employeeId) return false;
  if (sender.sectionUnitId === null || candidate.sectionUnitId === null) return false;
  if (candidate.sectionUnitId !== sender.sectionUnitId) return false;

  return direction === "down"
    ? rank(candidate.grade) > rank(sender.grade)
    : rank(candidate.grade) < rank(sender.grade);
}

/** The desks a sender may choose from, most senior first. */
export function eligibleDesks(sender: Desk, all: Desk[], direction: Direction): Desk[] {
  return all
    .filter((d) => canPassTo(sender, d, direction))
    .sort((a, b) => rank(a.grade) - rank(b.grade) || a.name.localeCompare(b.name));
}

/** How a movement reads in the file's history. */
export function describeMovement(m: {
  direction: string;
  fromName: string | null;
  toName: string;
}): string {
  if (m.direction === "receive") return `Received by ${m.toName}`;
  const verb = m.direction === "down" ? "Passed down to" : "Sent up to";
  return m.fromName ? `${verb} ${m.toName}, by ${m.fromName}` : `${verb} ${m.toName}`;
}
