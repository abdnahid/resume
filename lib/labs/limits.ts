/**
 * Which limits the applicant has to state, and what to print where he has.
 *
 * **Some standards do not fix a value — they require the manufacturer to.** A
 * tile's breaking strength, a fabric's length: the specification says *as
 * declared*, and what the bench is testing against is a number the applicant
 * gave. The FDO asks for it, writes it against the application, and the report
 * prints it in the *Standard limits* column where the catalogue's own text
 * would say nothing useful (D144).
 *
 * Prisma-free (D9): both the CM side, which collects the value, and the
 * laboratory, which tests against it, ask the same question here.
 */

/**
 * Does this leaf need the applicant to state a value?
 *
 * **Two signals, because the catalogue holds both.** `limitKind = declared` is
 * the classification the importers set — 48 parameters and 176 sub-parameters —
 * and it is the one to trust. But three of Ceramic Tiles' parameters carry the
 * text *"As per Declaration"* with `limitKind: rule`, which is the physical
 * sheet's wording read as a requirement rather than as a delegation. Matching
 * the text as well catches those, and catches whatever else the wings' files
 * word the same way; the three rows were corrected too, so the text test is a
 * net rather than the mechanism.
 */
export function needsDeclaredLimit(leaf: {
  limitKind: string | null | undefined;
  limitText: string | null | undefined;
}): boolean {
  if (leaf.limitKind === "declared") return true;
  return /\bdeclar/i.test(leaf.limitText ?? "");
}

/**
 * What to show in the *Standard limits* column.
 *
 * The declared value **replaces** the catalogue text rather than sitting beside
 * it, because the catalogue text is the instruction to declare — printing "As
 * per Declaration · 450 N" on a test report says the requirement twice and
 * answers it once. Where the catalogue qualifies the declaration — *"As
 * declared ± 2%"* — the qualification is kept, because the tolerance is the
 * requirement and the declared value is only its centre.
 */
export function limitForReport(
  leaf: { limitKind: string | null | undefined; limitText: string | null | undefined },
  declared: string | null | undefined,
): string | null {
  const text = leaf.limitText?.trim() || null;
  if (!needsDeclaredLimit(leaf)) return text;
  if (!declared?.trim()) return text;

  const value = declared.trim();
  // A bare instruction — "As declared", "As per Declaration" — is replaced.
  // Anything carrying a tolerance keeps it, with the value put in front.
  const bare = !text || /^(as\s+(per\s+)?declar\w*|declared)\.?$/i.test(text);
  return bare ? value : `${value} (${text})`;
}
