/**
 * The application state machine (spec §5.2). Prisma-free (D9).
 *
 * The applicant only ever drives the first two transitions. Everything below
 * `submitted` is declared so the tracker can render a file's whole journey —
 * including the stages it has not reached — and so the workflow engine has a
 * table to move against rather than inventing one.
 */
import type { ApplicationState } from "@/generated/prisma/client";

export type StageInfo = {
  state: ApplicationState;
  label: string;
  /** Who is holding the file in this state — the question §8 says matters most. */
  holder: "applicant" | "bsti" | "system" | "closed";
  /** Applicant-facing description of what is happening. */
  blurb: string;
};

/** The happy path, in order, for the applicant's stage tracker. */
export const STAGES: readonly StageInfo[] = [
  { state: "draft", label: "Draft", holder: "applicant", blurb: "You are still preparing this application." },
  { state: "pending_app_fee", label: "Application fee", holder: "applicant", blurb: "Pay the application fee to submit." },
  { state: "submitted", label: "Submitted", holder: "system", blurb: "Received by BSTI and waiting to be taken up." },
  { state: "received_by_director", label: "With the Wing Director", holder: "bsti", blurb: "The Director has the file." },
  { state: "in_channel_descending", label: "Being assigned", holder: "bsti", blurb: "Moving down to the officer who will review it." },
  { state: "assigned_to_fdo", label: "Assigned to an officer", holder: "bsti", blurb: "A FieldDuty Officer now holds the file." },
  { state: "under_review", label: "Under review", holder: "bsti", blurb: "Your documents are being checked." },
  { state: "review_passed", label: "Review passed", holder: "bsti", blurb: "The desk review is complete." },
  { state: "inspection_scheduled", label: "Inspection scheduled", holder: "bsti", blurb: "A factory inspection has been arranged." },
  { state: "inspection_completed", label: "Inspection done", holder: "bsti", blurb: "The inspection has been carried out." },
  { state: "test_fee_demanded", label: "Testing fee", holder: "applicant", blurb: "Pay the testing fee and deliver the sealed sample." },
  { state: "sample_received", label: "Sample received", holder: "bsti", blurb: "Your sample is with the laboratory." },
];

/** States that sit off the happy path. */
export const SIDE_STATES: Partial<Record<ApplicationState, StageInfo>> = {
  shortfall_issued: {
    state: "shortfall_issued",
    label: "Shortfall issued",
    holder: "applicant",
    blurb: "BSTI has asked for corrections. The clock is paused while it is with you.",
  },
  shortfall_responded: {
    state: "shortfall_responded",
    label: "Response submitted",
    holder: "bsti",
    blurb: "Your response is being checked.",
  },
  rejected: { state: "rejected", label: "Rejected", holder: "closed", blurb: "This application was not granted." },
  withdrawn: { state: "withdrawn", label: "Withdrawn", holder: "closed", blurb: "You withdrew this application." },
  lapsed: { state: "lapsed", label: "Lapsed", holder: "closed", blurb: "This application lapsed without a response." },
  inspection_failed: { state: "inspection_failed", label: "Inspection failed", holder: "closed", blurb: "The factory inspection was not passed." },
};

export function stageInfo(state: ApplicationState): StageInfo {
  return (
    STAGES.find((s) => s.state === state) ??
    SIDE_STATES[state] ?? {
      state,
      label: state.replace(/_/g, " "),
      holder: "bsti",
      blurb: "In progress at BSTI.",
    }
  );
}

/** How far along the happy path a state sits; -1 for side states. */
export function stageIndex(state: ApplicationState): number {
  return STAGES.findIndex((s) => s.state === state);
}

/** Can the applicant still change the application's contents? */
export function isEditable(state: ApplicationState): boolean {
  return state === "draft" || state === "pending_app_fee";
}

/**
 * How much of the application the applicant may change right now.
 *
 * Before submission, everything. While a shortfall round is open, **only the
 * points the officer marked** (D81) — that is what makes a shortfall an edit
 * permission rather than a request the applicant may answer by rewriting the
 * file. Otherwise nothing.
 *
 * Prisma-free, and the one place the question is answered, so the page that
 * greys a step out and the route that refuses the write cannot disagree.
 */
export type EditScope =
  | { kind: "all" }
  | { kind: "targets"; targets: readonly string[] }
  | { kind: "none" };

export function editScope(
  state: ApplicationState,
  openTargets: readonly string[] = [],
): EditScope {
  if (isEditable(state)) return { kind: "all" };
  if (state === "shortfall_issued") return { kind: "targets", targets: openTargets };
  return { kind: "none" };
}

export function canEditTarget(scope: EditScope, target: string): boolean {
  if (scope.kind === "all") return true;
  if (scope.kind === "none") return false;
  return scope.targets.includes(target);
}

/**
 * May the applicant touch documents at all — any one of them?
 *
 * Documents are marked individually (`document:<kind>`), so the step is open
 * when any single paper is, and `canEditTarget` then decides which.
 */
export function canEditAnyDocument(scope: EditScope): boolean {
  if (scope.kind === "all") return true;
  if (scope.kind === "none") return false;
  return scope.targets.some((t) => t.startsWith("document:"));
}

/**
 * The transitions the *applicant* may drive. Deliberately a short list — every
 * other move in §5.2 belongs to the workflow engine, and a transition table the
 * applicant's routes can reach is a transition the applicant can eventually be
 * tricked into making.
 */
const APPLICANT_TRANSITIONS: Partial<Record<ApplicationState, ApplicationState[]>> = {
  draft: ["pending_app_fee", "withdrawn"],
  pending_app_fee: ["draft", "submitted", "withdrawn"],
  // Answering a shortfall is the applicant's move; the officer decides what
  // happens next (D81). Withdrawal stays available — a file being corrected is
  // still the applicant's to abandon.
  shortfall_issued: ["shortfall_responded", "withdrawn"],
};

export function canApplicantMove(from: ApplicationState, to: ApplicationState): boolean {
  return (APPLICANT_TRANSITIONS[from] ?? []).includes(to);
}
