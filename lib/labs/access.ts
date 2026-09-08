/**
 * Who may change what in the laboratory module.
 *
 * Prisma-free (D9) so a screen can grey a control out from the same rule the
 * route refuses with, and the two cannot disagree — the shape `editScope()`
 * uses on the CM side.
 *
 * **Three different things, three different owners**, because they are three
 * different kinds of fact:
 *
 * | What | Who owns it | Why |
 * |---|---|---|
 * | the fee schedule | superadmin | it is the wing's published price, and an office that could edit it could discount its own applicants |
 * | what a lab can run | that lab's office | only the lab knows, and nobody else can find out |
 * | where a sample goes | that office | D64 — referral is arbitrary and the office decides it, which is the whole reason it is stored rather than derived |
 *
 * Reading is open to every member of staff. The catalogue is the published fee
 * schedule and the map is where samples go; an FDO planning a visit and an
 * examiner expecting a box both have reason to look, and neither has a reason
 * to be refused.
 */

export type LabActor = {
  role: string;
  employeeId: string | null;
  /** The office they are posted to, which is what scopes every write below. */
  officeId: number | null;
};

/**
 * The fee schedule, the limits, the methods — the wing's published catalogue.
 *
 * Superadmin alone. What a test costs is not an office's to change: an office
 * that could edit a fee could reduce what its own applicants pay, and the
 * figure is the wing's published one in any case.
 */
export function canEditCatalogue(actor: LabActor): boolean {
  return actor.role === "superadmin";
}

/**
 * What a given lab can actually run.
 *
 * Its own office, or a superadmin. `LabCapability` is sparse ground truth
 * (D64): a lab that has no working AAS cannot run heavy metals this month, and
 * head office cannot know that. The lab in-charge is the role for it; an office
 * head may do it too, because 22 offices have labs and only some will have
 * somebody in the specialised role.
 */
export function canEditCapability(actor: LabActor, labOfficeId: number): boolean {
  if (actor.role === "superadmin") return true;
  if (actor.officeId !== labOfficeId) return false;
  return actor.role === "lab_incharge" || actor.role === "office_head";
}

/**
 * Where this office sends a parameter it cannot run itself.
 *
 * The office's own decision, and deliberately not derivable: Barisal may send
 * what it cannot test to Cumilla rather than to a nearer, capable Khulna, and
 * the reason is administrative rather than geographic (D64).
 */
export function canEditRouting(actor: LabActor, officeId: number): boolean {
  if (actor.role === "superadmin") return true;
  if (actor.officeId !== officeId) return false;
  return actor.role === "lab_incharge" || actor.role === "office_head";
}

/**
 * Whether a lab is open for business at all.
 *
 * Superadmin, because it is a statement about the institution rather than about
 * one office's arrangements — and because deactivating a lab redirects every
 * office that routes to it.
 */
export function canEditRegistry(actor: LabActor): boolean {
  return actor.role === "superadmin";
}

/** The offices whose routing column this actor may edit — null means all. */
export function editableOffices(actor: LabActor): number[] | null {
  if (actor.role === "superadmin") return null;
  if (actor.officeId === null) return [];
  return canEditRouting(actor, actor.officeId) ? [actor.officeId] : [];
}
