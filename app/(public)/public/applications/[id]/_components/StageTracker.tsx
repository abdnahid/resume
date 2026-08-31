import { Check, Circle, Clock, XCircle } from "lucide-react";
import { STAGES, stageIndex, stageInfo } from "@/lib/cm/states";
import type { ApplicationState } from "@/generated/prisma/client";

/**
 * "Exactly which stage your file is at, and who holds it."
 *
 * Spec §8 calls this single feature most of the perceived value of the system,
 * and the reason is that it replaces a phone call. So the holder is named on
 * every stage — not just a tick and a label — and the current stage says
 * whether the file is waiting on BSTI or on the applicant.
 */
export default function StageTracker({ state }: { state: ApplicationState }) {
  const info = stageInfo(state);
  const current = stageIndex(state);
  const offPath = current === -1;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Progress</h2>
          <p className="mt-1 text-sm text-muted-foreground">{info.blurb}</p>
        </div>
        <HolderBadge holder={info.holder} />
      </div>

      {offPath && (
        <p className="mt-5 rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-foreground">
          <strong className="font-medium">{info.label}.</strong> {info.blurb}
        </p>
      )}

      <ol className="mt-6 space-y-0">
        {STAGES.map((s, i) => {
          const done = !offPath && i < current;
          const active = !offPath && i === current;
          return (
            <li key={s.state} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : active
                        ? "border-primary bg-secondary text-primary"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {done ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : active ? (
                    <Clock className="h-3 w-3" strokeWidth={2.5} />
                  ) : (
                    <Circle className="h-1.5 w-1.5 fill-current" strokeWidth={0} />
                  )}
                </span>
                {i < STAGES.length - 1 && (
                  <span className={`w-px flex-1 ${done ? "bg-primary/40" : "bg-border"}`} />
                )}
              </div>
              <div className={`min-w-0 pb-5 ${i === STAGES.length - 1 ? "pb-0" : ""}`}>
                <p
                  className={`text-sm ${
                    active ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </p>
                {active && <p className="mt-0.5 text-xs text-muted-foreground">{s.blurb}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function HolderBadge({ holder }: { holder: "applicant" | "bsti" | "system" | "closed" }) {
  const map = {
    applicant: { text: "Waiting on you", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    bsti: { text: "With BSTI", cls: "bg-secondary text-primary" },
    system: { text: "With BSTI", cls: "bg-secondary text-primary" },
    closed: { text: "Closed", cls: "bg-muted text-muted-foreground" },
  } as const;
  const m = map[holder];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${m.cls}`}>
      {holder === "closed" ? (
        <XCircle className="h-3.5 w-3.5" strokeWidth={2} />
      ) : (
        <Clock className="h-3.5 w-3.5" strokeWidth={2} />
      )}
      {m.text}
    </span>
  );
}
