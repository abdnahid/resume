import { CheckCircle2, Circle, FileText, FlaskConical, Hourglass, Lock } from "lucide-react";
import { LAB_STAGE_LABELS, type DestinationProgress, type LabStage } from "@/lib/cm/lab-progress";

/**
 * What the field officer is shown about testing — and the shape of it is the
 * point (D133).
 *
 * **Six stages and no rungs.** The client's own list: fee paid, awaiting
 * submission, received by One Stop, received by the wing, under test, report
 * approved. Which examiner holds an order, how long it has sat, whether a draft
 * was sent back — none of that appears, because it is the laboratory's own work
 * and an officer who could watch it would be supervising something he is not
 * accountable for.
 *
 * **Per destination office**, because that is how it actually happens: the
 * applicant carries a box to each, and one office finishing is real news while
 * the others are still running.
 *
 * **It says what it is waiting for, and it hands over the reports that are in**
 * (D147). Three things were missing and the client found all three at once:
 *
 * - The tracker showed the file's stage, which is the *least advanced*
 *   destination by D73 — so application 26, with Dhaka's report approved and
 *   two boxes not yet carried in, read "Awaiting sample submission" and nothing
 *   said a report existed. The outstanding line now names the offices still
 *   owed, because those are who the officer telephones.
 * - An approved report was unreachable from the file. It is a document about
 *   his sample and he is accountable for it, so each approved one is a link.
 * - Nothing said what happens after the last one. The consolidated report is
 *   the next act (A§8) and it appears the moment every report is in.
 */

const STEPS: LabStage[] = [
  "fee_unpaid",
  "awaiting_submission",
  "with_counter",
  "with_wing",
  "testing",
  "reported",
];

export default function LabProgress({
  applicationId,
  destinations,
  stage,
  verdict,
  approvedReports,
  totalReports,
  awaiting,
  complete,
}: {
  applicationId: number;
  destinations: DestinationProgress[];
  stage: LabStage;
  verdict: "pass" | "fail" | null;
  approvedReports: number;
  totalReports: number;
  awaiting: string[];
  complete: boolean;
}) {
  if (!destinations.length) return null;
  const reached = STEPS.indexOf(stage);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
        <FlaskConical size={16} strokeWidth={1.8} /> Testing
        {verdict && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              verdict === "fail"
                ? "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900"
                : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900"
            }`}
          >
            {verdict === "fail" ? "Failed" : "Passed"}
          </span>
        )}
      </h2>

      {/* **The headline, because the stage list alone was misleading.** The
          tracker reads the least advanced destination, so a file with one
          report approved and two boxes still to be carried in shows the
          earliest stage — true, and it hid the report. */}
      <p className="mb-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">
          {approvedReports} of {totalReports} {totalReports === 1 ? "report" : "reports"} approved
        </span>
        {awaiting.length > 0 && (
          <>
            {" · awaiting "}
            <span className="text-foreground">{awaiting.join(", ")}</span>
          </>
        )}
      </p>

      <ol className="mb-4 space-y-1.5">
        {STEPS.map((s, i) => {
          const done = i < reached;
          const now = i === reached;
          return (
            <li key={s} className="flex items-center gap-2 text-sm">
              {done ? (
                <CheckCircle2 size={15} className="shrink-0 text-primary" strokeWidth={1.8} />
              ) : (
                <Circle
                  size={15}
                  className={`shrink-0 ${now ? "text-primary" : "text-muted-foreground/40"}`}
                  strokeWidth={1.8}
                />
              )}
              <span
                className={
                  now
                    ? "font-medium text-foreground"
                    : done
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60"
                }
              >
                {LAB_STAGE_LABELS[s]}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          By destination ({destinations.length})
        </p>
        <ul className="space-y-2.5">
          {destinations.map((d) => (
            <li key={d.consignmentCode} className="text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{d.officeName}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                  {LAB_STAGE_LABELS[d.stage]}
                </span>
                {d.verdict && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      d.verdict === "fail"
                        ? "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900"
                        : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900"
                    }`}
                  >
                    {d.verdict}
                  </span>
                )}
              </p>
              <p className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                <span className="font-mono">{d.consignmentCode}</span>
                <span>seal {d.sealNo}</span>
                <span>
                  {d.reported} of {d.orders} {d.orders === 1 ? "report" : "reports"}
                </span>
              </p>

              {/* One row per order. An approved report is a link; an
                  outstanding one says so rather than offering a dead one. */}
              <ul className="mt-1.5 space-y-1">
                {d.orderList.map((o) => (
                  <li key={o.orderId} className="text-xs">
                    {o.approved ? (
                      <a
                        href={`/workflow/cm/${applicationId}/test-report/${o.orderId}`}
                        className="inline-flex flex-wrap items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-primary transition-colors hover:bg-primary/20"
                      >
                        <FileText className="h-3 w-3 shrink-0" strokeWidth={1.8} />
                        <span className="font-medium">{o.packageName}</span>
                        <span className="font-mono text-[10px] opacity-80">{o.reportNo}</span>
                        {o.verdict && (
                          <span
                            className={`font-medium ${
                              o.verdict === "fail" ? "text-red-700 dark:text-red-300" : ""
                            }`}
                          >
                            {o.verdict}
                          </span>
                        )}
                      </a>
                    ) : (
                      <span className="inline-flex flex-wrap items-center gap-1.5 px-2 py-1 text-muted-foreground">
                        <Hourglass className="h-3 w-3 shrink-0" strokeWidth={1.8} />
                        <span>{o.packageName}</span>
                        <span className="opacity-70">
                          {o.tests} {o.tests === 1 ? "test" : "tests"} · no report yet
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      {/* What happens after the last report (A§8). */}
      <div className="mt-4 border-t border-border pt-3">
        {complete ? (
          <>
            <a
              href={`/workflow/cm/${applicationId}/test-report`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <FileText className="h-3.5 w-3.5" strokeWidth={1.8} />
              Consolidated test report
            </a>
            <p className="mt-2 text-xs text-muted-foreground">
              Every report is in. The consolidated report compiles all{" "}
              {totalReports === 1 ? "of it" : `${totalReports} of them`} into one determination for
              the product — review it, then assess the marking fee.
            </p>
            {/* Disabled rather than absent, and it says why: the marking fee
                schedule is the client's to supply and nothing may invent a
                figure an applicant would be charged. */}
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3 shrink-0" strokeWidth={1.8} />
              Marking fee — waiting on BSTI&apos;s licence fee schedule
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            The consolidated test report is compiled once every laboratory has reported.{" "}
            {awaiting.length > 0 && (
              <>
                Still outstanding at{" "}
                <span className="font-medium text-foreground">{awaiting.join(", ")}</span>.
              </>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
