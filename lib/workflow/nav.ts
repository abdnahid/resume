/**
 * The `/workflow` navbar, in one place.
 *
 * It is built from what the viewer actually holds, because two of the three
 * destinations are not everyone's: the counter belongs to whoever holds
 * `one_stop` at an office (D93), and the letter inbox only exists for a desk
 * something was addressed to (D130). Listing them unconditionally advertises
 * screens that answer `notFound()`, which the house rule forbids — and leaving
 * them off entirely was worse, because the counter was reachable only by typing
 * its URL.
 *
 * Prisma-free (D9): it decides from flags the caller has already resolved.
 */
export function workflowNav(opts: { counter: boolean; letters: boolean }) {
  return [
    { label: "Files", href: "/workflow" },
    ...(opts.counter ? [{ label: "One Stop", href: "/workflow/counter" }] : []),
    ...(opts.letters ? [{ label: "My letters", href: "/workflow/letters" }] : []),
  ];
}
