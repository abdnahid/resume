"use client";

import { useState } from "react";
import PracticeStep from "./PracticeStep";
import SubmitStep from "./SubmitStep";
import type { Gap } from "@/lib/cm/policy";

/**
 * The last step, holding the two halves together.
 *
 * `gaps` is computed on the server at page load, so the submission checklist
 * used to keep naming a question that had just been answered until the
 * applicant pressed Save — the answer was on the screen and the list below it
 * disagreed. `PracticeStep` now reports what it satisfies as it is typed, and
 * the checklist drops those immediately.
 *
 * **The server still decides.** `missingForSubmission()` is re-run at the fee
 * gate and is the only thing that can let a file through; this stops the screen
 * lying, it does not stand in for the check.
 */
export default function Step4({
  applicationId,
  answers,
  consentAcceptedAt,
  prefill,
  gaps,
  feeStatus,
  feeReference,
  editable,
}: {
  applicationId: number;
  answers: { questionKey: string; answerText: string | null; answerNumber: number | null }[];
  consentAcceptedAt: string | null;
  prefill: {
    fromApplicationId: number;
    fromProduct: string | null;
    answers: { questionKey: string; answerText: string | null; answerNumber: number | null }[];
  } | null;
  gaps: Gap[];
  feeStatus: string | null;
  feeReference: string | null;
  editable: boolean;
}) {
  const [satisfied, setSatisfied] = useState<string[]>([]);

  // Only this step's own gaps can be answered here — the ones from steps 1–3
  // stand until their own step is completed.
  const live = gaps.filter((g) => !(g.step === 4 && satisfied.includes(g.field)));

  return (
    <>
      <PracticeStep
        applicationId={applicationId}
        answers={answers}
        consentAcceptedAt={consentAcceptedAt}
        prefill={prefill}
        onSatisfiedChange={setSatisfied}
        editable={editable}
      />

      {editable && (
        <SubmitStep
          applicationId={applicationId}
          gaps={live}
          feeStatus={feeStatus}
          feeReference={feeReference}
        />
      )}
    </>
  );
}
