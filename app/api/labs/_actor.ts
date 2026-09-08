import { requireInternal } from "@/lib/auth-guard";
import { actorFor } from "@/lib/workflow/inbox";
import type { LabActor } from "@/lib/labs/access";

/**
 * Who is asking, and which office they work in.
 *
 * `actorFor()` is reused rather than reimplemented: "which office is this
 * person posted to" already has one definition — the current posting, falling
 * back to the legacy column — and a second one here would eventually disagree
 * with it. Same discipline as `employeesOfOffice()` on the payroll side.
 */
export async function labActor(): Promise<LabActor> {
  const viewer = await requireInternal();
  const actor = await actorFor(viewer);
  return { role: actor.role, employeeId: actor.employeeId, officeId: actor.officeId };
}
