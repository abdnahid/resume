import { CheckCircle2, Circle, FlaskConical } from "lucide-react";
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
  destinations,
  stage,
  verdict,
}: {
  destinations: DestinationProgress[];
  stage: LabStage;
  verdict: "pass" | "fail" | null;
}) {
  if (!destinations.length) return null;
  const reached = STEPS.indexOf(stage);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <FlaskConical size={16} strokeWidth={1.8} /> Testing
        {verdict && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              verdict === "fail"
                ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
            }`}
          >
            {verdict === "fail" ? "Failed" : "Passed"}
          </span>
        )}
      </h2>

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
        <ul className="space-y-2">
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
                        ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                        : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
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
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
