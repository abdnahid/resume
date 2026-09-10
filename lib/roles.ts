/**
 * Internal roles, and what each one reaches.
 *
 * Prisma-free so both the role screen and the route can use it. It lives here
 * rather than in the route because a Next route module may only export route
 * handlers — exporting anything else makes the generated route-type validator
 * fail with "Property 'x' is incompatible with index signature".
 */

/**
 * `client` is deliberately absent. It is inert and belongs to the public lane
 * (D11), so it must never be assignable to a member of staff.
 */
export const ASSIGNABLE_ROLES = [
  "superadmin",
  "officeadmin",
  "office_head",
  "case_officer",
  "one_stop",
  "lab_entry",
  "data_entry",
  "employee",
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isAssignableRole(v: unknown): v is AssignableRole {
  return ASSIGNABLE_ROLES.includes(v as AssignableRole);
}

export const ROLE_LABELS: { value: AssignableRole; label: string; hint: string }[] = [
  { value: "superadmin", label: "Superadmin", hint: "Everything, including this screen" },
  { value: "officeadmin", label: "Office admin", hint: "Their own office's staff, payroll and advice" },
  {
    value: "office_head",
    label: "Office head",
    hint: "Receives their office's licence applications and passes them down",
  },
  { value: "case_officer", label: "Case officer", hint: "Court cases and verdicts, every office" },
  {
    value: "one_stop",
    label: "One Stop counter",
    hint: "Receives sealed samples at their office. Payment is read-only to them.",
  },
  {
    value: "lab_entry",
    label: "Lab data entry",
    hint: "Records what their own office can test, and where the rest is sent",
  },
  { value: "data_entry", label: "Data entry", hint: "Records only" },
  { value: "employee", label: "Employee", hint: "Their own profile" },
];

/**
 * A role's display name. Falls back to the stored value rather than to "Unknown"
 * — `client` is not assignable but is a real value on a real row, and showing it
 * verbatim is more honest than hiding it behind a placeholder.
 */
export function roleLabel(role: string): string {
  return ROLE_LABELS.find((r) => r.value === role)?.label ?? role;
}

/**
 * **A person may hold several roles** (D122), and authorisation must ask this
 * rather than compare `User.role`.
 *
 * One column was accepted deliberately in D57 — payroll authority and
 * file-routing authority are different jobs — until the client pointed out
 * (2026-09-10) that rarely they are the same person: an office admin who is
 * also the office head and enters the lab data. With one column, granting the
 * second silently removed the first, which is why `import:office-heads` had to
 * move `officeadmin` to another desk at 14 of 23 offices.
 *
 * **It falls back to the primary when the set was not selected**, which makes
 * the change safe by construction: `role` is always a member of `roles`, so a
 * caller that forgot to select the array is never *more* permissive than
 * before — only less, and only for a secondary role. It can therefore be rolled
 * out one query at a time without a window where something is over-permitted.
 *
 * The session cookie carries the primary only. **Authorisation on a secondary
 * role must go through `getViewer()`**, which reads the row.
 */
export function hasRole(
  subject: { role?: string | null; roles?: readonly string[] | null } | null | undefined,
  role: string,
): boolean {
  if (!subject) return false;
  if (subject.roles?.length) return subject.roles.includes(role);
  return subject.role === role;
}

/** True if the subject holds any of these. */
export function hasAnyRole(
  subject: { role?: string | null; roles?: readonly string[] | null } | null | undefined,
  ...roles: string[]
): boolean {
  return roles.some((r) => hasRole(subject, r));
}

/**
 * Most authority first. `User.role` is kept as the highest-precedence member of
 * `roles` so that a screen showing one role shows the most consequential one,
 * and so a check still comparing the primary errs towards the top of the list
 * rather than somewhere arbitrary.
 */
export const ROLE_PRECEDENCE: readonly AssignableRole[] = [
  "superadmin",
  "officeadmin",
  "office_head",
  "case_officer",
  "one_stop",
  "lab_entry",
  "data_entry",
  "employee",
];

/** The primary for a set — the one `User.role` must hold. */
export function primaryRole(roles: readonly string[]): AssignableRole {
  for (const r of ROLE_PRECEDENCE) if (roles.includes(r)) return r;
  return "employee";
}
