import Link from "next/link";
import { Mail, PackageCheck, TriangleAlert, Zap } from "lucide-react";
import ModuleNavbar from "@/components/layout/ModuleNavbar";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor } from "@/lib/workflow/inbox";
import { lettersForViewer } from "@/lib/cm/letter-inbox";
import { formatPoisha } from "@/lib/payments/money";
import { hasAnyRole } from "@/lib/roles";
import { workflowNav } from "@/lib/workflow/nav";
import { workOrderCountForViewer } from "@/lib/labs/board";
import { labActorFor } from "@/lib/labs/testing";

export const dynamic = "force-dynamic";

/**
 * The sampling letters addressed to this desk (D130).
 *
 * **Not a board of files.** Every other screen in `/workflow` is keyed on an
 * application, and this one cannot be: a Faridpur inspection sends a box to
 * Khulna, so Khulna's officer is asked to expect samples on a file they have
 * never held and have no standing to open. Asked through the application they
 * were refused, and the letters sat in the database with no reader.
 *
 * So it lists letters, and each one leads to the letter itself rather than to
 * the file behind it.
 *
 * **It is the counter's inbox and nothing else now** (D138). A wing-head letter
 * *is* a work order — the same instruction, already written as a `LabTestOrder`
 * — so listing it here as well made one thing into two destinations and left
 * the wing head to reconcile them. It is read at `/workflow/work-order`, where
 * the work is. A counter letter has no work order behind it: the counter takes
 * the box and tests nothing, so this screen is where it belongs.
 */
export default async function MyLettersPage() {
  const viewer = await requireInternal("/workflow/letters");
  const actor = await actorFor(viewer);
  const letters = await lettersForViewer(actor);
  const navItems = workflowNav({
    counter: hasAnyRole(actor, "one_stop", "superadmin") && actor.officeId !== null,
    letters: true,
    workOrders: (await workOrderCountForViewer(labActorFor(actor))) > 0,
  });

  const waiting = letters.filter((l) => l.submittedAt === null);
  const arrived = letters.filter((l) => l.submittedAt !== null);

  return (
    <>
      <ModuleNavbar moduleName="Workflow" moduleSubtitle="BSTI e-Services" navItems={navItems} />
      <main className="mx-auto w-full max-w-[1440px] px-5 py-12 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Sampling letters
        </p>
        <h1 className="mt-2 font-display text-3xl font-medium text-foreground">Counter letters</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          Letters addressed to your One Stop counter after an approved
          inspection. Each names one sealed box coming to this office, who is
          carrying it, and whether the testing fee is settled — the box cannot
          be taken in until it is. A letter asking a wing to <em>test</em>
          something is a work order and is read there instead.
        </p>

        {letters.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center">
            <Mail className="mx-auto h-6 w-6 text-muted-foreground" strokeWidth={1.6} />
            <p className="mt-3 text-sm font-medium text-foreground">No letters</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              A letter reaches your counter when an inspection sends a sealed
              box to this office.
            </p>
          </div>
        ) : (
          <>
            <Section title="Awaiting the box" rows={waiting} />
            <Section title="Received" rows={arrived} />
          </>
        )}
      </main>
    </>
  );
}

function Section({
  title,
  rows,
}: {
  title: string;
  rows: Awaited<ReturnType<typeof lettersForViewer>>;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title} ({rows.length})
      </h2>
      <ul className="mt-3 space-y-2">
        {rows.map((l) => (
          <li key={l.id}>
            <Link
              href={`/workflow/letters/${l.id}`}
              className="block rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="min-w-0">
                  {/* Every row here is a counter letter now (D138), so the
                      kind is stated rather than branched on. */}
                  <p className="text-sm font-medium text-foreground">
                    One Stop counter
                    <span className="text-muted-foreground"> · {l.officeName}</span>
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{l.letterNo}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {l.issuedAt.toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {l.boxCode && (
                  <span className="rounded-md bg-secondary px-2 py-1 font-mono text-secondary-foreground">
                    {l.boxCode}
                  </span>
                )}
                {l.sealNo && (
                  <span className="text-muted-foreground">
                    seal <span className="font-mono">{l.sealNo}</span>
                  </span>
                )}
                <span className="text-muted-foreground">
                  {l.specimenCount} specimen{l.specimenCount === 1 ? "" : "s"}
                </span>

                {/* Urgent is a scheduling instruction, so it belongs on the row
                    a wing head scans and not only inside the letter (D134). */}
                {l.urgent && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-1 font-semibold text-rose-700 dark:text-rose-400">
                    <Zap className="h-3 w-3" strokeWidth={2} />
                    Urgent
                  </span>
                )}

                {l.submittedAt ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 font-medium text-emerald-700 dark:text-emerald-400">
                    <PackageCheck className="h-3 w-3" strokeWidth={2} />
                    Received
                  </span>
                ) : l.feePaid ? (
                  <span className="rounded-md bg-emerald-500/10 px-2 py-1 font-medium text-emerald-700 dark:text-emerald-400">
                    Testing fee paid
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 font-medium text-amber-700 dark:text-amber-400">
                    <TriangleAlert className="h-3 w-3" strokeWidth={2} />
                    Testing fee unpaid
                    {l.feePoisha !== null && ` · ${formatPoisha(l.feePoisha)}`}
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
