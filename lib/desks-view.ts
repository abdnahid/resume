/**
 * The desks screen's shapes and grouping rule — **Prisma-free** (D9).
 *
 * **It exists because the client component needs them.** `StaffTitleManager`
 * imports `STAFF_GROUP` and these types; importing them from
 * `lib/desks-designations.ts`, which queries, pulls `pg` into the browser
 * bundle and the page 500s with `Can't resolve 'fs'`. That is the split
 * `lib/store/bds-catalog.ts` and `lib/store/bds.ts` already make, and
 * `lib/desk-title.ts` beside it. Keep this file free of `@/lib/prisma`.
 */

/**
 * **The shape of everything this screen caches. Bump it when that changes.**
 *
 * A cache key names *what* is cached, never what it looks like — so adding
 * `isSanctioned` to `DeskOption` left every stored entry valid and shaped the
 * old way, and the screen read the new field as `undefined` on 557 desks. It
 * labelled all of them "outside the organogram": an assertion about a
 * government establishment, made because a field failed to arrive.
 *
 * It lives here, in the Prisma-free half, because the server cache and the
 * client's query key both need it and two copies would drift — which is the
 * same class of mistake one layer down.
 */
export const PAYLOAD_SHAPE = "v6";

export type DesignationOption = {
  id: number;
  titleEn: string;
  titleBn: string | null;
  rankLabel: string;
  rankOrder: number;
  isOfficer: boolean;
  wing: string | null;
  /** The heading this goes under in the picker. */
  group: string;
};

export type DeskOption = {
  id: number;
  titleEn: string;
  unitEn: string;
  unitId: number;
  grade: string | null;
  sanctioned: number;
  held: number;
  rankLabel: string;
  /** False for a desk created outside the approved organogram (D155). */
  isSanctioned: boolean;
  /** Which seat of this title in this unit (D156) — 1, 2, 3 … */
  seatNo: number;
  /** Who currently holds it, so two identical seats can be told apart. */
  heldBy: string | null;
};

export type DeskTenureKind = "substantive" | "additional_charge" | "attachment";

export const TENURE_LABEL: Record<DeskTenureKind, string> = {
  substantive: "own post",
  additional_charge: "additional charge",
  attachment: "attached",
};

export type HeldDesk = {
  orgPostId: number;
  titleEn: string;
  unitEn: string;
  kind: DeskTenureKind;
  /** `kind === "substantive"` — their own post, the one files route to. */
  isPrimary: boolean;
  note: string | null;
};

export type StaffRow = {
  id: string;
  nameEn: string;
  nameBn: string | null;
  grade: string | null;
  officeId: number | null;
  designationId: number | null;
  recordedEn: string | null;
  designationIsInferred: boolean;
  /** Grades 1–9. Officers group by section; everybody else is one Staff group. */
  isOfficer: boolean;
  /** The wing their designation belongs to. Kept for the designation picker. */
  wing: string | null;
  /** The organogram unit their primary desk sits in — the heading (D158a). */
  sectionEn: string | null;
  /** The chart's own ordering for that unit, so sections read as it does. */
  sectionOrder: number;
  desks: HeldDesk[];
  /** The primary desk's post id, or null. */
  primaryPostId: number | null;
  deskIsInferred: boolean;
  /** True when the primary desk's title and the designation are different ranks. */
  rankDiffers: boolean;
};

/**
 * The picker's headings.
 *
 * **Officers by wing, everybody else under one Staff heading** — the client's
 * rule. Grades 1–9 are the officer cadre and which wing they belong to is the
 * distinction that matters when choosing among 88 officer titles; grades 10–20
 * are clerical and trade desks where the wing means nothing, so 42 titles sit
 * under one heading rather than being scattered across eight.
 */
export const STAFF_GROUP = "Staff (grade 10–20)";

export function designationGroup(d: { isOfficer: boolean; wing: string | null }): string {
  return d.isOfficer ? (d.wing ?? "Other wings") : STAFF_GROUP;
}

/**
 * The heading one employee sits under in the roster (D158, amended 2026-09-22).
 *
 * **The organogram's own section, not the designation's wing.** The client's
 * call: *"I think it is better to arrange based on organogram setup."* He is
 * right, and my first reading was the weaker one — the unit *is* the section an
 * office is actually laid out in (*CM, Faridpur*, *Metrology, Faridpur*), while
 * a wing is a coarser abstraction that a branch office does not even have.
 *
 * The objection I raised — that rows move between headings as desks are
 * assigned — is real and turns out to be a feature: somebody jumping into their
 * section is the confirmation that the assignment took.
 *
 * **Nobody seated yet is the worklist**, so they group under their own heading
 * whatever their grade, rather than being scattered through the sections they
 * do not belong to yet.
 */
export const NO_DESK_GROUP = "No desk yet";

export function staffSection(r: {
  isOfficer: boolean;
  sectionEn: string | null;
}): string {
  if (!r.sectionEn) return NO_DESK_GROUP;
  return r.isOfficer ? r.sectionEn : STAFF_GROUP;
}
