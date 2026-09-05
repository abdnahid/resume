/**
 * The correction loop between the reviewing officer and the applicant (D81).
 *
 * The officer previews the whole file, marks what is wrong, and sends it back.
 * The applicant may then edit **exactly** the marked points and respond. The
 * officer looks again and either marks more or declares the file ready for
 * processing. It runs as many rounds as it takes — the client's own rule, which
 * settles the "maximum rounds" half of spec §10 #7.
 *
 * **The file never leaves the officer's desk.** `holderEmployeeId` is untouched
 * throughout: the work is his, and the *state* is what says the applicant owes a
 * response. Handing it back would put it in an applicant's inbox, which does not
 * exist, and lose the officer who has been reading it.
 *
 * **A shortfall is an edit permission, not a note.** Each marked point is a row
 * naming the part of the application that reopens, and `editScope()` in
 * `states.ts` is the one place that turns those rows into "may I write this".
 * A covering note would leave the officer's intent unenforceable.
 *
 * Server half (D9) — `states.ts` and `policy.ts` hold the Prisma-free rules.
 */
import { prisma } from "@/lib/prisma";
import { editScope, type EditScope } from "./states";
import { allShortfallTargets } from "./policy";

/** The round awaiting an answer, if there is one. */
export async function openRound(applicationId: number) {
  return prisma.shortfallRound.findFirst({
    where: { applicationId, respondedAt: null },
    include: {
      items: { orderBy: { id: "asc" } },
      raisedBy: { select: { nameEn: true, designationEn: true, designationBn: true } },
    },
    orderBy: { roundNo: "desc" },
  });
}

/** Every round, newest first — the record of what was asked and when. */
export async function roundsFor(applicationId: number) {
  return prisma.shortfallRound.findMany({
    where: { applicationId },
    include: {
      items: { orderBy: { id: "asc" } },
      raisedBy: { select: { nameEn: true, designationEn: true, designationBn: true } },
    },
    orderBy: { roundNo: "desc" },
  });
}

/**
 * What the applicant may edit on this application right now.
 *
 * Reads the open round, so callers cannot forget to. Both the page that greys a
 * step out and the route that refuses the write go through here.
 */
export async function editScopeFor(applicationId: number): Promise<EditScope> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { state: true },
  });
  if (!app) return { kind: "none" };
  const round = app.state === "shortfall_issued" ? await openRound(applicationId) : null;
  return editScope(app.state, round?.items.map((i) => i.target) ?? []);
}

/**
 * The officer asks for corrections.
 *
 * Guarded on the caller **holding** the file, not on a role: the loop is between
 * whoever is reviewing and the applicant, and an officer two desks away who can
 * read the file (D80) must not be able to write to the applicant in its name.
 *
 * Refuses an empty mark list. A round with no points would move the file to the
 * applicant and reopen nothing, so they would be asked to fix something and
 * given no way to do it.
 */
export async function raiseShortfall(args: {
  applicationId: number;
  employeeId: string;
  note: string | null;
  items: { target: string; comment: string }[];
}) {
  const known = new Set(allShortfallTargets().map((t) => t.target));
  const items = args.items
    .filter((i) => known.has(i.target))
    .map((i) => ({ target: i.target, comment: i.comment.trim() }))
    .filter((i) => i.comment.length > 0);
  if (items.length === 0) {
    throw new Error("Mark at least one point, and say what is wrong with it.");
  }

  const app = await prisma.application.findUniqueOrThrow({
    where: { id: args.applicationId },
    select: { state: true, holderEmployeeId: true },
  });
  if (app.holderEmployeeId !== args.employeeId) {
    throw new Error("Only whoever is holding this file can ask for corrections.");
  }
  if (app.state === "shortfall_issued") {
    throw new Error("A correction request is already open on this file.");
  }
  if (!REVIEWABLE.includes(app.state)) {
    throw new Error(`A file at "${app.state}" is not open for corrections.`);
  }

  const last = await prisma.shortfallRound.findFirst({
    where: { applicationId: args.applicationId },
    orderBy: { roundNo: "desc" },
    select: { roundNo: true },
  });

  // One transaction: a round whose state did not move would leave the applicant
  // with points to fix and no permission to fix them.
  const [round] = await prisma.$transaction([
    prisma.shortfallRound.create({
      data: {
        applicationId: args.applicationId,
        roundNo: (last?.roundNo ?? 0) + 1,
        raisedByEmployeeId: args.employeeId,
        note: args.note?.trim() || null,
        items: { create: items },
      },
      include: { items: true },
    }),
    prisma.application.update({
      where: { id: args.applicationId },
      data: { state: "shortfall_issued" },
    }),
  ]);
  return round;
}

/**
 * The applicant says they have made the corrections.
 *
 * The round closes and the state returns to the officer. Nothing checks that
 * the points were *actually* addressed — that judgement is the officer's, and
 * it is why he looks again rather than the system deciding for him.
 */
export async function respondToShortfall(args: {
  applicationId: number;
  userId: string;
  response: string | null;
}) {
  const round = await openRound(args.applicationId);
  if (!round) throw new Error("There is no open correction request on this application.");

  await prisma.$transaction([
    prisma.shortfallRound.update({
      where: { id: round.id },
      data: {
        respondedAt: new Date(),
        respondedByUserId: args.userId,
        response: args.response?.trim() || null,
      },
    }),
    prisma.application.update({
      where: { id: args.applicationId },
      data: { state: "shortfall_responded" },
    }),
  ]);
  return round.id;
}

/**
 * The officer ends the loop: the file is ready to be processed.
 *
 * `review_passed` is the existing state for "the desk review is complete", so
 * this is not a new stage in the applicant's tracker — it is the one the tracker
 * already draws.
 */
export async function markReadyForProcessing(args: {
  applicationId: number;
  employeeId: string;
}) {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: args.applicationId },
    select: { state: true, holderEmployeeId: true },
  });
  if (app.holderEmployeeId !== args.employeeId) {
    throw new Error("Only whoever is holding this file can mark it ready.");
  }
  if (app.state === "shortfall_issued") {
    throw new Error("A correction request is still open. It has to be answered first.");
  }
  if (!REVIEWABLE.includes(app.state)) {
    throw new Error(`A file at "${app.state}" is not under review.`);
  }
  return prisma.application.update({
    where: { id: args.applicationId },
    data: { state: "review_passed" },
    select: { id: true, state: true },
  });
}

/**
 * The states a file can be reviewed from.
 *
 * Deliberately generous at the front: a file may still be `submitted` when the
 * officer opens it, because the workflow engine that walks it through
 * `received_by_director` → `assigned_to_fdo` is not built yet (step 8+), and
 * refusing on that would make the review loop unusable until it is.
 */
const REVIEWABLE: string[] = [
  "submitted",
  "received_by_director",
  "in_channel_descending",
  "assigned_to_fdo",
  "under_review",
  "shortfall_issued",
  "shortfall_responded",
];
