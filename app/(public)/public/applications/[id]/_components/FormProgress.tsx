import { Check, Dot } from "lucide-react";
import StepNavButton from "@/components/StepNavButton";
import type { Gap, FormStep } from "@/lib/cm/policy";

/**
 * Where the applicant is in the form — not where the file is in BSTI.
 *
 * `StageTracker` answers "who holds my file", which is only a question once the
 * file has been submitted; before that every application sits in `draft` and the
 * tracker says the same thing to everyone. While the form is being filled the
 * useful question is the other one: what is still missing, and on which step.
 *
 * So the two swap over at submission. This one counts outstanding items per
 * step rather than showing a percentage, because a count tells you what to do
 * next and a percentage only tells you how far you are.
 */
export default function FormProgress({
  applicationId,
  steps,
  current,
}: {
  applicationId: number;
  steps: { step: FormStep; titleEn: string; blurbEn: string; outstanding: number; complete: boolean }[];
  current: FormStep;
  gaps?: Gap[];
}) {
  const done = steps.filter((s) => s.complete).length;

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-foreground">Your application</h2>
        <span className="text-xs text-muted-foreground">
          {done} of {steps.length} done
        </span>
      </div>

      <ol className="mt-5 space-y-1">
        {steps.map((s) => {
          const active = s.step === current;
          return (
            <li key={s.step}>
              <StepNavButton
                href={`/public/applications/${applicationId}?step=${s.step}`}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                  active
                    ? "border-primary/40 bg-secondary/50"
                    : "border-transparent hover:border-border hover:bg-secondary/30"
                }`}
              >
                <span className="flex w-full items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                      s.complete
                        ? "border-primary bg-primary text-primary-foreground"
                        : active
                          ? "border-primary text-primary"
                          : "border-border text-muted-foreground"
                    }`}
                  >
                    {s.complete ? <Check className="h-3 w-3" strokeWidth={3} /> : s.step}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm font-medium ${active ? "text-foreground" : "text-foreground/90"}`}
                    >
                      {s.titleEn}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {s.complete ? (
                        s.blurbEn
                      ) : (
                        <>
                          {s.outstanding} item{s.outstanding === 1 ? "" : "s"} still needed
                        </>
                      )}
                    </span>
                  </span>
                </span>
              </StepNavButton>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The outstanding items for one step, listed where that step is shown. */
export function StepGaps({ gaps }: { gaps: Gap[] }) {
  if (gaps.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
        Still needed on this step
      </p>
      <ul className="mt-2 space-y-1">
        {gaps.map((g) => (
          <li key={g.field} className="flex items-start gap-1.5 text-sm text-foreground">
            <Dot className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" strokeWidth={3} />
            <span>{g.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Previous / next, so the form can be walked without the sidebar. */
export function StepNav({
  applicationId,
  current,
  last,
}: {
  applicationId: number;
  current: FormStep;
  last: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      {current > 1 ? (
        <StepNavButton
          href={`/public/applications/${applicationId}?step=${current - 1}`}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary/50"
        >
          Back
        </StepNavButton>
      ) : (
        <span />
      )}
      {current < last && (
        <StepNavButton
          href={`/public/applications/${applicationId}?step=${current + 1}`}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Continue
        </StepNavButton>
      )}
    </div>
  );
}
