/**
 * Where a page may send someone next.
 *
 * Prisma-free on purpose (D9): the payment return page, the profile wizard and
 * the apply picker all carry a `?next=` between them, and a client component
 * importing the payment service would drag `pg` into the browser bundle.
 */

/**
 * An app-relative path, or null.
 *
 * Anything else — an absolute URL, a protocol-relative `//host`, a bare word —
 * is discarded rather than corrected, so a crafted `?next=` cannot turn the
 * page that honours it into an open redirect.
 */
export function safeNext(next?: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}
