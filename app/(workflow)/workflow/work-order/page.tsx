import Link from "next/link";
import { FlaskConical, AlertTriangle, Mail } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireInternal } from "@/lib/auth-guard";
import ModuleNavbar from "@/components/layout/ModuleNavbar";
import PageContainer from "@/components/PageContainer";
import { workflowNav } from "@/lib/workflow/nav";
import { actorFor } from "@/lib/workflow/inbox";
import {
  lettersForWorkOrders,
  letterCountForViewer,
  type WorkOrderLetter,
} from "@/lib/cm/letter-inbox";
import { formatPoisha } from "@/lib/payments/money";
import { hasAnyRole } from "@/lib/roles";
import { ORDER_STATE_LABELS, type LabOrderState } from "@/lib/labs/ladder";
import { ladderHealth, ordersForViewer } from "@/lib/labs/board";
import { labActorFor } from "@/lib/labs/testing";

export const dynamic = "force-dynamic";

/**
 * The work orders this office is holding — the testing wing's own board (D133),
 * and since D137 a `/workflow` screen rather than a `/labs` one.
 *
 * **It moved because the letter and the order are one instruction.** The FDO
 * issues a wing-head letter saying *test these parameters on this package*; the
 * `LabTestOrder` is that sentence as a row somebody works. They were two
 * modules apart, so a wing head read the paper at `/workflow/letters` and did
 * the work at `/labs/orders`, with nothing joining them. `/labs` keeps the
 * catalogue, the coverage and the registry — tables you maintain; a work order
 * is a file you work, and files are worked in `/workflow`.
 *
 * **Not a variant of the file board.** A file moves through the institution by
 * seniority; a laboratory receives boxes, distributes specimens and reports on
 * them, and the thing that moves carries no application at all (D70). So this
 * board names packages and specimen counts, and there is nowhere on it to learn
 * whose they are — except the letter, which is the reader's own and is blinded
 * too (D71).
 */
export default async function WorkOrdersPage() {
  const viewer = await requireInternal("/workflow/work-order");
  const actor = await actorFor(viewer);

  const labActor = labActorFor(actor);

  const [orders, health, office, letterCount] = await Promise.all([
    ordersForViewer(labActor),
    actor.officeId ? ladderHealth(actor.officeId) : Promise.resolve(null),
    actor.officeId
      ? prisma.office.findUnique({
          where: { id: actor.officeId },
          select: { nameEn: true },
        })
      : Promise.resolve(null),
    letterCountForViewer(actor),
  ]);

  // The letter behind each order, resolved in one pass rather than per card.
  const letters = await lettersForWorkOrders(
    orders.map((o) => o.id),
    actor,
  );

  const navItems = workflowNav({
    counter: hasAnyRole(actor, "one_stop", "superadmin") && actor.officeId !== null,
    letters: letterCount > 0,
    workOrders: true,
  });

  const waiting = orders.filter((o) => o.state === "awaiting_sample");
  const live = orders.filter((o) => !["awaiting_sample", "reported", "cancelled"].includes(o.state));
  const done = orders.filter((o) => ["reported", "cancelled"].includes(o.state));

  return (
    <>
      <ModuleNavbar moduleName="Workflow" moduleSubtitle="BSTI e-Services" navItems={navItems} />
      <PageContainer>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Laboratory</p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-medium text-foreground">
            <FlaskConical size={20} strokeWidth={1.8} /> Work orders
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {office?.nameEn ?? "Your office"} — the packages sent here for testing, and where each
            has got to. Each one is the letter you were sent, as work.
          </p>
        </div>

        {/* Said on the board rather than discovered when somebody tries to act:
            an office with nobody on a wing-head desk cannot receive a sample at
            all, and one with no examiner or assistant director cannot record a
            reading. Both are read from the organogram (D136), so the fix is a
            seat and not a grant. */}
        {health?.problems.length ? (
          <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
            {health.problems.map((p) => (
              <p key={p} className="flex gap-2 text-sm text-amber-900 dark:text-amber-200">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                {p}
              </p>
            ))}
            <p className="pt-1 text-xs text-amber-800 dark:text-amber-300">
              Corrected at <span className="font-medium">/hr/listing/desks</span>.
            </p>
          </div>
        ) : null}

        <Section
          title="Expected"
          orders={waiting}
          letters={letters}
          empty="Nothing on its way here."
        />
        <Section title="On the bench" orders={live} letters={letters} empty="Nothing under test." />
        <Section
          title="Reported"
          orders={done}
          letters={letters}
          empty="No approved reports yet."
        />
      </PageContainer>
    </>
  );
}

function Section({
  title,
  orders,
  letters,
  empty,
}: {
  title: string;
  orders: Awaited<ReturnType<typeof ordersForViewer>>;
  letters: Map<number, WorkOrderLetter>;
  empty: string;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">
        {title}
        <span className="ml-2 text-xs font-normal tabular-nums text-muted-foreground">
          {orders.length}
        </span>
      </h2>
      {orders.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {orders.map((o) => {
            const letter = letters.get(o.id);
            return (
              /* **The row is a stretched link, not a link wrapping everything.**
                 The letter has to be a real second destination, and an anchor
                 inside an anchor is invalid HTML that browsers repair by
                 dropping one of them. The pseudo-element makes the whole card
                 clickable; the letter chip sits above it on its own layer. */
              <li
                key={o.id}
                className="relative flex flex-col gap-2 px-4 py-3 hover:bg-secondary/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <Link
                  href={`/workflow/work-order/${o.id}`}
                  className="min-w-0 after:absolute after:inset-0"
                >
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">{o.code}</span>
                    {o.isUrgent && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-red-200">
                        urgent
                      </span>
                    )}
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                      {ORDER_STATE_LABELS[o.state as LabOrderState] ?? o.state}
                    </span>
                  </p>
                  <p className="mt-1 truncate text-sm text-foreground">
                    {o.subProduct.product.nameEn}
                    <span className="text-muted-foreground"> · {o.subProduct.nameEn}</span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                    <span>{o.lab?.nameEn ?? "sent out"}</span>
                    <span>
                      {o._count.items} {o._count.items === 1 ? "parameter" : "parameters"}
                    </span>
                    <span>
                      {o._count.specimens} {o._count.specimens === 1 ? "specimen" : "specimens"}
                    </span>
                    {letter?.boxCode && <span className="font-mono">{letter.boxCode}</span>}
                  </p>
                  {/* **What the letter's own inbox row used to warn about**
                      (D138). The counter refuses a box while the testing fee is
                      outstanding (D129), so a wing head waiting on samples needs
                      to see that here rather than wondering why they never
                      come. */}
                  {letter && !letter.feePaid && letter.feePoisha !== null && (
                    <p className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      <AlertTriangle size={12} strokeWidth={2} />
                      Testing fee unpaid · {formatPoisha(letter.feePoisha)}
                    </p>
                  )}
                </Link>
                <div className="relative shrink-0 text-xs sm:text-right">
                  {o.holder && (
                    <p className="text-muted-foreground">
                      with <span className="font-medium text-foreground">{o.holder.nameEn}</span>
                    </p>
                  )}
                  {o.report?.reportNo && (
                    <p className="mt-0.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          o.report.verdict === "fail"
                            ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                            : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        }`}
                      >
                        {o.report.verdict}
                      </span>
                    </p>
                  )}
                  {/* The letter this order came from — offered only to the
                      officer it is addressed to, so it never opens on a
                      refusal (D137). */}
                  {letter && (
                    <Link
                      href={`/workflow/letters/${letter.id}`}
                      className="relative z-10 mt-1 inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary"
                    >
                      <Mail size={12} strokeWidth={1.8} />
                      {letter.letterNo}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
