import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes, ShieldCheck } from "lucide-react";
import ModuleNavbar from "@/components/layout/ModuleNavbar";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor, consignmentsForCounter } from "@/lib/workflow/inbox";
import { prisma } from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";
import { workflowNav } from "@/lib/workflow/nav";
import { letterCountForViewer } from "@/lib/cm/letter-inbox";

export const dynamic = "force-dynamic";

/**
 * The One Stop Service Centre counter (D93).
 *
 * **A desk, not a person.** Whoever is assigned `one_stop` at an office sees
 * the boxes coming to that office, so the counter keeps working when the
 * officer on it changes — which is the whole reason it is a role rather than a
 * name on a consignment.
 *
 * **Boxes are listed by the laboratory's office, not the file's.** The
 * applicant carries each box to the office of the lab that will test it, and
 * that is often not the office the application belongs to. A counter scoped to
 * its own office's files would miss exactly the boxes walking through its door.
 *
 * The payment column is **read-only and always will be** (spec §5.2): a counter
 * that could mark a file paid would be a counter that can be argued with.
 */
export default async function CounterPage() {
  const viewer = await requireInternal("/workflow/counter");
  const actor = await actorFor(viewer);
  // Asked of the whole set: a counter clerk at a small office may also be its
  // head, and with one column granting the second removed the first (D122).
  if (!hasAnyRole(actor, "one_stop", "superadmin")) notFound();
  if (!actor.officeId) notFound();

  const navItems = workflowNav({
    counter: true,
    letters: (await letterCountForViewer(actor)) > 0,
  });

  const [office, boxes] = await Promise.all([
    prisma.office.findUnique({ where: { id: actor.officeId }, select: { nameEn: true, nameBn: true } }),
    consignmentsForCounter(actor.officeId),
  ]);

  const waiting = boxes.filter((b) => b.state === "awaiting_submission");
  const done = boxes.filter((b) => b.state !== "awaiting_submission");

  return (
    <>
      <ModuleNavbar moduleName="Workflow" moduleSubtitle="BSTI e-Services" navItems={navItems} />
      <main className="mx-auto w-full max-w-[1440px] px-5 py-12 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          One Stop Service Centre
        </p>
        <h1 className="mt-2 font-display text-3xl font-medium text-foreground">
          <span className="font-bn">{office?.nameBn ?? office?.nameEn}</span>
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sealed boxes coming to this office&rsquo;s laboratories. Check the seal
          against the number on the letter before you accept one — a broken seal
          is a refusal, not a note.
        </p>

        <Section title={`Expected (${waiting.length})`} boxes={waiting} />
        <Section title={`Received (${done.length})`} boxes={done} />
      </main>
    </>
  );
}

function Section({
  title,
  boxes,
}: {
  title: string;
  boxes: Awaited<ReturnType<typeof consignmentsForCounter>>;
}) {
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 font-display text-lg font-medium text-foreground">
        <Boxes className="h-4 w-4 text-primary" strokeWidth={2} />
        {title}
      </h2>
      {boxes.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Nothing here.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {boxes.map((b) => (
            <li
              key={b.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-foreground">{b.code}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                    {b.state.replace(/_/g, " ")}
                  </span>
                </p>
                <p className="mt-1.5 text-sm font-medium text-foreground">
                  {b.application.organization.nameEn}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{b.application.applicationNo ?? `#${b.application.id}`}</span>
                  <span>{b.office?.nameEn ?? "—"}</span>
                  <span>
                    {b._count.registry} {b._count.registry === 1 ? "specimen" : "specimens"}
                  </span>
                  {b.application.bstiOffice && <span>filed at {b.application.bstiOffice.nameEn}</span>}
                </p>
                {b.application.letters[0] && (
                  /* The letter itself, not just its number (D130). The clerk
                     checks the box against the seal number printed on it, and
                     the copy the applicant carries is the same document. */
                  <p className="mt-1.5 text-xs">
                    <Link
                      href={`/workflow/letters/${b.application.letters[0].id}`}
                      className="text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                    >
                      letter <span className="font-mono">{b.application.letters[0].letterNo}</span>
                    </Link>
                  </p>
                )}
                {b.sealNo && (
                  <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2 py-1 text-xs">
                    <ShieldCheck className="h-3 w-3 shrink-0 text-primary" strokeWidth={1.8} />
                    seal <span className="font-mono font-medium">{b.sealNo}</span>
                  </p>
                )}
              </div>

              <div className="shrink-0 sm:text-right">
                {/* Read-only, and only ever read (spec §5.2). A counter that
                    could mark a file paid is a counter that can be argued
                    with. */}
                {(() => {
                  const paid = b.application.testFeePayment?.status === "paid";
                  const due = b.application.testFeePoisha;
                  return (
                    <p
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${
                        paid
                          ? "bg-secondary text-secondary-foreground"
                          : "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
                      }`}
                    >
                      testing fee{" "}
                      {paid
                        ? "paid"
                        : `unpaid${due ? ` — ৳${(due / 100).toLocaleString("en-BD")}` : ""}`}
                    </p>
                  );
                })()}
                {b.application.testFeePayment?.status !== "paid" && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    the box cannot be received yet
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  application fee
                  <span
                    className={`ml-1.5 font-medium ${
                      b.application.applicationFeePayment?.status === "paid"
                        ? "text-primary"
                        : "text-destructive"
                    }`}
                  >
                    {b.application.applicationFeePayment?.status ?? "not raised"}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {b.submittedAt
                    ? `handed in ${b.submittedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                    : "not yet handed in"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
