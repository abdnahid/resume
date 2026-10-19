/**
 * The desks screen's reads — **straight from the database, deliberately**.
 *
 * **The server-side cache was removed on 2026-09-21, after its third bug.**
 * It was `unstable_cache`, tagged per office with a 300-second window, and on a
 * screen whose whole purpose is correcting data it cost far more than it
 * earned:
 *
 * 1. Adding a field to `DeskOption` left every stored entry shaped the old way,
 *    so 557 desks read `isSanctioned` as `undefined` and the screen labelled
 *    every one of them "outside the organogram".
 * 2. `/api/employees/[id]/desk` — the route the desk pickers actually use —
 *    never called `revalidateTag`, so setting somebody's desk changed the
 *    database while the screen went on serving the stale payload **even after a
 *    reload**, for up to five minutes.
 * 3. Before either, it made the page hard to reason about while a separate
 *    fault was being diagnosed.
 *
 * Each was individually fixable. Together they say something simpler: a cache
 * whose correctness depends on **every current and future write path
 * remembering to invalidate it** is a standing invitation to exactly this bug,
 * and what it was protecting is three queries on a screen one administrator
 * uses at a time.
 *
 * **TanStack Query stays** (D154). Client-side caching is what makes switching
 * offices and filters feel instant; it is invalidated by the mutation that
 * caused the change rather than by a route remembering to; and when it is wrong
 * the worst case is one stale render a refetch corrects — not a write that
 * appears not to have happened.
 *
 * If these queries ever become slow enough to want caching back, cache them
 * behind the *service*, keyed on the rows they actually read, rather than
 * behind a tag every caller has to remember.
 *
 * **They did become slow, and they were made fast instead** (D159, 2026-09-23).
 * Head office's three reads took about 2.7 seconds, which is nine round trips
 * to Neon — Prisma loads each relation level as its own query. They are now one
 * round trip each and take about 0.2 seconds together, so there is still
 * nothing here worth the risk of a stale write.
 */
import { deskOptions, designationOptions, staffOfOffice } from "@/lib/desks-designations";
import type { DesignationOption, DeskOption, StaffRow } from "@/lib/desks-view";

export function cachedStaff(officeId: number): Promise<StaffRow[]> {
  return staffOfOffice(officeId);
}

export function cachedDesks(officeId: number): Promise<DeskOption[]> {
  return deskOptions(officeId);
}

export function cachedDesignations(): Promise<DesignationOption[]> {
  return designationOptions();
}

/**
 * A no-op, kept so the write routes calling it need not change and so a reader
 * finds this note rather than wondering where invalidation went. There is
 * nothing to invalidate: every read above goes to the database.
 */
export function revalidateOffice(_officeId: number | null | undefined): void {
  // Nothing is cached on the server for this screen. See the note above.
}
