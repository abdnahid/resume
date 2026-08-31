/**
 * Identity and route-classification helpers shared by the edge middleware, the
 * server guards and client components.
 *
 * Prisma-free on purpose (D9) — `middleware.ts` runs on the edge runtime and the
 * login form runs in the browser. Neither can pull `pg` in. Keep every import in
 * this file dependency-free.
 */

/** Route prefixes only BSTI staff may reach. Everything else is public. */
export const INTERNAL_PREFIXES = [
  "/hr",
  "/workflow",
  "/accounts",
  "/inventory",
  "/admin",
  "/print",
] as const;

/** Where a signed-in employee lands, and where internal redirects point. */
export const INTERNAL_HOME = "/hr";

/** Where clients — and anyone refused an internal route — are sent. */
export const CLIENT_HOME = "/";

export function isInternalPath(pathname: string): boolean {
  return INTERNAL_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * API lanes that are *not* internal-only. Everything else under `/api` is.
 *
 * Default-deny is the right way round, so each entry here is a decision:
 *
 * - `/api/auth`     better-auth itself; signing in cannot require being signed in.
 * - `/api/client`   the client-facing lane (company profiles, factories).
 * - `/api/store`    buying a standard. Any signed-in account may (D13) — an
 *                   employee buying a BDS is a buyer who happens to have an
 *                   employee ID — so gating it on INTERNAL would refuse every
 *                   actual customer.
 * - `/api/payments` the gateway's lane. The IPN callback is made by the payment
 *                   gateway server-to-server with **no session at all**, so it
 *                   cannot sit behind an account check of any kind.
 *
 * Being outside the internal gate is not the same as being unguarded: each
 * route still enforces its own rule. `/api/store/checkout` demands a session;
 * the IPN handler trusts the request body for nothing but a reference, and asks
 * the gateway what really happened before settling anything.
 */
export const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/client",
  "/api/store",
  "/api/payments",
] as const;

export function isInternalApiPath(pathname: string): boolean {
  if (!pathname.startsWith("/api")) return false;
  return !PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// ─── Mobile numbers ──────────────────────────────────────────────────────────

/**
 * Bangladeshi mobile: 11 digits, `01`, then an operator digit 3–9.
 * Accepts `+8801…`, `8801…` and `01…` and normalises all three to `01…`.
 */
export function normalizeMobile(input: string): string {
  const digits = input.replace(/[^\d]/g, "");
  if (digits.startsWith("880")) return `0${digits.slice(3)}`;
  if (digits.length === 10 && digits.startsWith("1")) return `0${digits}`;
  return digits;
}

export function isValidMobile(input: string): boolean {
  return /^01[3-9]\d{8}$/.test(normalizeMobile(input));
}

// ─── Login lane detection ────────────────────────────────────────────────────

/**
 * Employee IDs and Bangladeshi mobile numbers are *both* 11-digit numeric
 * strings, so nothing can tell them apart — which is why the login page has two
 * explicit lanes rather than one clever field. Within the client lane, though,
 * mobile-vs-email is unambiguous, so that single field detects its own input.
 */
export function clientIdentifierKind(input: string): "email" | "mobile" {
  return input.includes("@") ? "email" : "mobile";
}

// ─── Placeholder emails ──────────────────────────────────────────────────────

/**
 * better-auth 1.6.9 has no email-less sign-up path — `/sign-up/email` requires a
 * valid address — so a mobile-only client is created with a synthesised one.
 * It is never shown and never mailed; it is replaced the moment the client adds
 * a real address. better-auth does the same thing internally for phone sign-ups
 * (`signUpOnVerification.getTempEmail`).
 */
const PLACEHOLDER_DOMAIN = "mobile.bsti.invalid";

export function placeholderEmail(mobile: string): string {
  return `${normalizeMobile(mobile)}@${PLACEHOLDER_DOMAIN}`;
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(`@${PLACEHOLDER_DOMAIN}`);
}

/** The email to show a client — a placeholder reads as "no email on file". */
export function displayEmail(email: string | null | undefined): string | null {
  return isPlaceholderEmail(email) ? null : (email ?? null);
}
