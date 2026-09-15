/**
 * The `/workflow` navbar, in one place.
 *
 * It is built from what the viewer actually holds, because two of the three
 * destinations are not everyone's: the counter belongs to whoever holds
 * `one_stop` at an office (D93), and a work order belongs to the wing testing
 * it (D137). Listing them unconditionally advertises screens that answer
 * `notFound()`, which the house rule forbids — and leaving them off entirely
 * was worse, because the counter was reachable only by typing its URL.
 *
 * **Work orders sit beside files rather than beside the counter**: those two are
 * work somebody is doing, and the counter is a desk things arrive at.
 *
 * **There is no letter tab of either kind, deliberately** (D138, D139). A
 * letter is an instruction about work, and every instruction is read where its
 * work is done: the FDO's letter to a wing head *is* the work order, and his
 * letter to a counter *is* the box on the counter's own screen. Tabs for them
 * made one thing into two destinations — and in the counter's case the two
 * screens were the same list, scoped the same way and split on the same field,
 * rendered twice. The paper still has a page at `/workflow/letters/[id]`,
 * reached from the work it belongs to.
 *
 * Prisma-free (D9): it decides from flags the caller has already resolved.
 */
export function workflowNav(opts: {
  counter: boolean;
  /** Any testing work visible to this person — `workOrderCountForViewer()`. */
  workOrders?: boolean;
}) {
  return [
    { label: "Files", href: "/workflow" },
    ...(opts.workOrders ? [{ label: "Work orders", href: "/workflow/work-order" }] : []),
    ...(opts.counter ? [{ label: "One Stop", href: "/workflow/counter" }] : []),
  ];
}
