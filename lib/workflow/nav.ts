/**
 * The `/workflow` navbar, in one place.
 *
 * It is built from what the viewer actually holds, because three of the four
 * destinations are not everyone's: the counter belongs to whoever holds
 * `one_stop` at an office (D93), the letter inbox only exists for a desk
 * something was addressed to (D130), and a work order belongs to the wing
 * testing it (D137). Listing them unconditionally advertises screens that
 * answer `notFound()`, which the house rule forbids — and leaving them off
 * entirely was worse, because the counter was reachable only by typing its URL.
 *
 * **Work orders sit beside files rather than beside letters**: these two are
 * work somebody is doing, and the counter and the inbox are desks things arrive
 * at.
 *
 * **There is no wing-head letter tab, deliberately** (D138). The FDO's letter
 * to a wing head *is* the work order — the same instruction, already written as
 * a `LabTestOrder` — so a tab for each made one thing into two destinations.
 * The letter's substance is on the work order and the paper is one click from
 * it. **`letters` is the counter's inbox**, which is why the entry says
 * *Counter letters*: a counter takes the box and tests nothing, so its letter
 * has no work order behind it.
 *
 * Prisma-free (D9): it decides from flags the caller has already resolved.
 */
export function workflowNav(opts: {
  counter: boolean;
  letters: boolean;
  /** Any testing work visible to this person — `workOrderCountForViewer()`. */
  workOrders?: boolean;
}) {
  return [
    { label: "Files", href: "/workflow" },
    ...(opts.workOrders ? [{ label: "Work orders", href: "/workflow/work-order" }] : []),
    ...(opts.counter ? [{ label: "One Stop", href: "/workflow/counter" }] : []),
    ...(opts.letters ? [{ label: "Counter letters", href: "/workflow/letters" }] : []),
  ];
}
