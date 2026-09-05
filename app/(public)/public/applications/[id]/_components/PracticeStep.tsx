"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, ClipboardList, Sparkles } from "lucide-react";
import { CM_QUESTIONS } from "@/lib/cm/policy";
import { answersSchema } from "@/lib/cm/schemas";

const fieldCls = (bad: boolean) =>
  `w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:ring-2 ${
    bad
      ? "border-destructive/60 focus:border-destructive focus:ring-destructive/15"
      : "border-border focus:border-primary focus:ring-primary/15"
  }`;

type Answer = { questionKey: string; answerText: string | null; answerNumber: number | null };

/**
 * Step 4 — how the factory is run, and the declaration.
 *
 * These are the questions an inspecting officer would otherwise ask on the
 * telephone or on the day, so they are asked once, in writing, and travel with
 * the file.
 *
 * Answers save as a set rather than field by field: they are long, and an
 * autosave firing mid-sentence would keep storing half-written ones. The
 * declaration sits at the bottom and is only offered once every required answer
 * is given — it says the answers above are true, so it cannot be signed over
 * blanks.
 */
export default function PracticeStep({
  applicationId,
  answers,
  consentAcceptedAt,
  prefill,
  onSatisfiedChange,
  editable,
}: {
  applicationId: number;
  answers: Answer[];
  consentAcceptedAt: string | null;
  prefill: { fromApplicationId: number; fromProduct: string | null; answers: Answer[] } | null;
  /**
   * The gap fields this step currently satisfies, emitted as they are typed.
   * The submission checklist below is built from the server's gap list, which
   * is a page-load snapshot — without this it goes on naming a question that
   * has just been answered until someone presses Save.
   */
  onSatisfiedChange?: (fields: string[]) => void;
  editable: boolean;
}) {
  const router = useRouter();

  const initial: Record<string, string> = {};
  for (const g of CM_QUESTIONS)
    for (const q of g.questions) {
      const a = answers.find((x) => x.questionKey === q.key);
      initial[q.key] =
        q.type === "number"
          ? a?.answerNumber === null || a?.answerNumber === undefined
            ? ""
            : String(a.answerNumber)
          : (a?.answerText ?? "");
    }

  const [consent, setConsent] = useState(!!consentAcceptedAt);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  /**
   * Validated live against the same schema the route parses. Before this the
   * warnings came only from the server's gap list, so a question stayed marked
   * as missing until the applicant pressed Save — the answer was already on the
   * screen and the form still disagreed with it.
   *
   * `mode: "onChange"` with `setValue(..., { shouldValidate: true })` on the
   * prefill is what makes the count fall as the answers are typed.
   */
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<Record<string, string>>({
    resolver: zodResolver(answersSchema.partial()),
    mode: "onChange",
    defaultValues: initial,
  });

  const values = watch();

  // What is still missing, computed here rather than waited for from the
  // server. The server still decides at the fee gate — this only stops the
  // screen lying to someone who has just answered.
  const required = CM_QUESTIONS.flatMap((g) => g.questions).filter((q) => q.required);
  const liveOutstanding = required.filter((q) => {
    const v = values[q.key];
    return q.type === "number" ? !String(v ?? "").trim() : !String(v ?? "").trim();
  }).length;

  // The same field ids `missingForSubmission()` uses, so the checklist can drop
  // them without knowing anything about this form.
  const satisfied = [
    ...required.filter((q) => String(values[q.key] ?? "").trim()).map((q) => `q:${q.key}`),
    ...(consent ? ["consent"] : []),
  ];
  // `watch()` returns a fresh object each render, so the effect keys on the
  // resolved list rather than on the values themselves.
  const satisfiedKey = satisfied.join("|");
  useEffect(() => {
    onSatisfiedChange?.(satisfiedKey ? satisfiedKey.split("|") : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satisfiedKey]);

  function applyPrefill() {
    if (!prefill) return;
    for (const a of prefill.answers) {
      const v =
        a.answerNumber !== null && a.answerNumber !== undefined
          ? String(a.answerNumber)
          : (a.answerText ?? "");
      setValue(a.questionKey, v, { shouldValidate: true, shouldDirty: true });
    }
    setPrefilled(true);
    setSaved(false);
  }

  const save = (withConsent: boolean) =>
    handleSubmit(async (form) => {
      setError(null);
      try {
        const res = await fetch(`/api/client/applications/${applicationId}/answers`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: form, consent: withConsent }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Could not save.");
        setConsent(withConsent);
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save.");
      }
    })();

  return (
    <div className="space-y-6">
      {editable && prefill && !prefilled && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-secondary/40 p-5">
          <p className="flex items-start gap-2 text-sm text-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
            <span>
              You answered these for this factory on an earlier application
              {prefill.fromProduct ? ` (${prefill.fromProduct})` : ""}. Copy those answers across?
              The manpower, quality-control and records answers describe the plant, so they are
              likely the same.
            </span>
          </p>
          <button
            type="button"
            onClick={applyPrefill}
            className="shrink-0 rounded-lg border border-primary/40 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/10"
          >
            Copy them in
          </button>
        </div>
      )}

      {CM_QUESTIONS.map((group) => (
        <section key={group.key} className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <ClipboardList className="h-4 w-4 text-primary" strokeWidth={1.8} />
            {group.titleEn}
          </h2>
          {group.blurbEn && (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {group.blurbEn}
            </p>
          )}

          <div
            className={`mt-6 gap-5 ${
              group.questions.every((q) => q.type === "number")
                ? "grid grid-cols-2 sm:grid-cols-4"
                : "space-y-5"
            }`}
          >
            {group.questions.map((q) => (
              <div key={q.key} className={q.type === "number" ? "" : "max-w-3xl"}>
                <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor={q.key}>
                  {q.labelEn}
                  {!q.required && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (optional)
                    </span>
                  )}
                </label>
                {q.hintEn && <p className="mb-2 text-xs text-muted-foreground">{q.hintEn}</p>}
                {q.type === "longtext" ? (
                  <textarea
                    id={q.key}
                    rows={4}
                    className={fieldCls(!!errors[q.key])}
                    disabled={!editable}
                    {...register(q.key, { onChange: () => setSaved(false) })}
                  />
                ) : (
                  <input
                    id={q.key}
                    className={fieldCls(!!errors[q.key])}
                    inputMode={q.type === "number" ? "numeric" : "text"}
                    disabled={!editable}
                    {...register(q.key, { onChange: () => setSaved(false) })}
                  />
                )}
                {errors[q.key]?.message && (
                  <p className="mt-1 text-xs text-destructive">
                    {String(errors[q.key]?.message)}
                  </p>
                )}
                {/* Unanswered is not an error until they have been there. */}
                {!errors[q.key] &&
                  q.required &&
                  touchedFields[q.key] &&
                  !String(values[q.key] ?? "").trim() && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-500">
                      This answer is needed before you can submit.
                    </p>
                  )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h2 className="font-semibold text-foreground">Declaration</h2>
        <label className="mt-4 flex items-start gap-3 text-sm leading-relaxed text-foreground">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
            checked={consent}
            disabled={!editable || (liveOutstanding > 0 && !consent)}
            onChange={(e) => {
              setConsent(e.target.checked);
              setSaved(false);
            }}
          />
          <span>
            I confirm that the information given in this application — about the company, the
            factory, the product, the articles it covers, the production figures and the answers
            above — is true and complete to the best of my knowledge. I understand that BSTI may
            inspect the factory and draw samples, and that a licence granted on wrong information
            may be withdrawn.
          </span>
        </label>

        {liveOutstanding > 0 && !consent && (
          <p className="mt-3 text-xs text-muted-foreground">
            {liveOutstanding} required answer{liveOutstanding === 1 ? "" : "s"} above still to give
            before you can make this declaration. This updates as you type — no need to save first.
          </p>
        )}

        {consentAcceptedAt && consent && (
          <p className="mt-3 text-xs text-muted-foreground">
            Declared on{" "}
            {new Date(consentAcceptedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            .
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {editable && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => save(consent)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />}
              Save answers
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
                Saved
              </span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
