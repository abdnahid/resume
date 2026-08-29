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
  "case_officer",
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
  { value: "case_officer", label: "Case officer", hint: "Court cases and verdicts, every office" },
  { value: "data_entry", label: "Data entry", hint: "Records only" },
  { value: "employee", label: "Employee", hint: "Their own profile" },
];
