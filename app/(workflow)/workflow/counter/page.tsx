import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes, FileText, ShieldCheck, TriangleAlert, Zap } from "lucide-react";
import ModuleNavbar from "@/components/layout/ModuleNavbar";
import PageContainer from "@/components/PageContainer";
import { requireInternal } from "@/lib/auth-guard";
import { actorFor, consignmentsForCounter } from "@/lib/workflow/inbox";
import { prisma } from "@/lib/prisma";
import { hasAnyRole } from "@/lib/roles";
import { workflowNav } from "@/lib/workflow/nav";
import { type CounterLetter, lettersForCounterBoxes } from "@/lib/cm/letter-inbox";
import { formatPoisha } from "@/lib/payments/money";
import { workOrderCountForViewer } from "@/lib/labs/board";
import { labActorFor } from "@/lib/labs/testing";
import ReceiveBox from "./_components/ReceiveBox";

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
 * **The box is the counter's work order, and its letter is on it** (D139).
 * There was a separate inbox at `/workflow/letters`, and it was not a second
 * view of this screen so much as the *same* one: both scoped to `officeId`,
 * both split on whether the box had been handed in, and the rows strictly one
 * to one — one `one_stop` letter per office, and the unique on `Consignment`
 * (application, office) guaranteeing exactly one box to match. A clerk had to
 * notice that his two lists were the same list. So the letter's substance is on
 * the card — its memo number, who issued it and when, urgent or not, the seal
 * to check, the jar count and the date the applicant was given — and the paper
 * itself is one click away, because a letter is a printed document and still
 * needs a page.
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
    workOrders: (await workOrderCountForViewer(labActorFor(actor))) > 0,
  });

  const [office, boxes] = await Promise.all([
    prisma.office.findUnique({ where: { id: actor.officeId }, select: { nameEn: true, nameBn: true } }),
    consignmentsForCounter(actor.officeId),
  ]);

  // The letter behind each box, in one query rather than one per card — the
  // round trip to Neon is the cost here and a busy counter has a column of them.
  const letters = await lettersForCounterBoxes(
    boxes.map((b) => b.application.id),
    actor,
    actor.officeId,
  );

  const waiting = boxes.filter((b) => b.state === "awaiting_submission");
  const done = boxes.filter((b) => b.state !== "awaiting_submission");

  return (
    <>
      <ModuleNavbar moduleName="Workflow" moduleSubtitle="BSTI e-Services" navItems={navItems} />
      <PageContainer>
        <div className="py-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            One Stop Service Centre
          </p>
          <h1 className="mt-2 font-display text-3xl font-medium text-foreground">
            <span className="font-bn">{office?.nameBn ?? office?.nameEn}</span>
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Sealed boxes coming to this office&rsquo;s laboratories, each with
            the letter that announced it. Check the seal against the number on
            the letter before you accept one — a broken seal is a refusal, not a
            note.
          </p>
        </div>

        <Section title={`Expected (${waiting.length})`} boxes={waiting} letters={letters} />
        <Section title={`Received (${done.length})`} boxes={done} letters={letters} />
      </PageContainer>
    </>
  );
}

const day = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function Section({
  title,
  boxes,
  letters,
}: {
  title: string;
  boxes: Awaited<ReturnType<typeof consignmentsForCounter>>;
  letters: Map<number, CounterLetter>;
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
          {boxes.map((b) => {
            const letter = letters.get(b.application.id) ?? null;
            const paid = b.application.testFeePayment?.status === "paid";
            return (
              <li
                key={b.id}
                className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">{b.code}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                      {b.state.replace(/_/g, " ")}
                    </span>
                    {/* Urgent is an instruction about this box, so it sits where
                        the clerk scans and not only inside the letter (D134). */}
                    {letter?.urgent && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-400">
                        <Zap className="h-3 w-3" strokeWidth={2} />
                        Urgent
                      </span>
                    )}
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-foreground">
                    {b.application.organization.nameEn}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{b.application.applicationNo ?? `#${b.application.id}`}</span>
                    <span>{b.office?.nameEn ?? "—"}</span>
                    {b.application.bstiOffice && <span>filed at {b.application.bstiOffice.nameEn}</span>}
                  </p>

                  {/* **The letter, on the box it is about** (D139). What the
                      clerk checks the box against: the seal number, how many
                      jars to expect, and the date the applicant was given. */}
                  <div className="mt-3 rounded-xl border border-border/70 bg-secondary/40 p-3">
                    {letter ? (
                      <>
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.8} />
                          <span className="font-medium text-foreground">Letter</span>
                          <span className="font-mono text-muted-foreground">{letter.letterNo}</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          issued by {letter.issuedBy.name}
                          {letter.issuedBy.designation && `, ${letter.issuedBy.designation}`}
                          {" · "}
                          {day(letter.issuedAt)}
                        </p>
                      </>
                    ) : (
                      /* A box whose letter this desk may not read, or that was
                         sealed before the letters went out. The seal and the
                         jar count still have to be checked, so they are said
                         here rather than lost with the letter. */
                      <p className="text-xs text-muted-foreground">
                        No letter on this box for this counter.
                      </p>
                    )}

                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                      {b.sealNo && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-card px-2 py-1">
                          <ShieldCheck className="h-3 w-3 shrink-0 text-primary" strokeWidth={1.8} />
                          seal <span className="font-mono font-medium">{b.sealNo}</span>
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        {b._count.registry} {b._count.registry === 1 ? "jar" : "jars"}
                      </span>
                      {letter && (
                        <span className="text-muted-foreground">due {day(letter.dueOn)}</span>
                      )}
                    </p>

                    {letter && (
                      <p className="mt-2.5 flex flex-wrap items-center gap-3 text-xs">
                        <Link
                          href={`/workflow/letters/${letter.id}`}
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          Read the letter
                        </Link>
                        <a
                          href={`/api/workflow/letters/${letter.id}/pdf`}
                          className="text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                        >
                          PDF
                        </a>
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0 sm:text-right">
                  {/* Read-only, and only ever read (spec §5.2). A counter that
                      could mark a file paid is a counter that can be argued
                      with. */}
                  <p
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${
                      paid
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
                    }`}
                  >
                    {!paid && <TriangleAlert className="h-3 w-3 shrink-0" strokeWidth={2} />}
                    testing fee{" "}
                    {paid
                      ? "paid"
                      : `unpaid${
                          b.application.testFeePoisha !== null
                            ? ` — ${formatPoisha(b.application.testFeePoisha)}`
                            : ""
                        }`}
                  </p>
                  {!paid && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      the box cannot be received yet
                    </p>
                  )}
                  {/* The counter's one write in the whole flow (D93). It renders
                      only while the box is still expected — a box already taken
                      in, or refused, is a record and not an errand. */}
                  {b.state === "awaiting_submission" && (
                    <ReceiveBox code={b.code} feePaid={paid} />
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
                    {b.submittedAt ? `handed in ${day(b.submittedAt)}` : "not yet handed in"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
