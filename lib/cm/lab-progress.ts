/**
 * What the CM side learns about testing — and, just as much, what it does not
 * (D133).
 *
 * **This file is the crossing, and it is deliberately one-way and narrow.** A
 * `LabTestOrder` carries no application column (D70); the two sides meet only
 * at `SampleRegistration`, so reaching from a file to its testing means walking
 * consignment → registration → sample → order. Doing that in one named place
 * is the point: the join exists once, it is read-only, and it returns a stage
 * rather than a bench.
 *
 * **The FDO sees six things and no rungs.** The client's own list:
 *
 *     testing fee paid → awaiting sample reception → received by One Stop
 *       → received by the wing → [testing] → test report approved
 *
 * Which examiner holds an order, how long it sat, who sent it back — none of
 * that crosses. It is the laboratory's own business, and an FDO who could watch
 * it would be supervising work he is not accountable for.
 */
import { prisma } from "@/lib/prisma";

export type LabStage =
  | "fee_unpaid"
  | "awaiting_submission"
  | "with_counter"
  | "with_wing"
  | "testing"
  | "reported";

export const LAB_STAGE_LABELS: Record<LabStage, string> = {
  fee_unpaid: "Testing fee requested",
  awaiting_submission: "Awaiting sample submission",
  with_counter: "Samples received by One Stop",
  with_wing: "Samples received by the wing",
  testing: "Under test",
  reported: "Test report approved",
};

/** One destination office's progress, as the FDO is allowed to see it. */
export type DestinationProgress = {
  officeId: number | null;
  officeName: string;
  consignmentCode: string;
  sealNo: string;
  boxState: string;
  /** How many of this box's orders have an approved report, out of how many. */
  reported: number;
  orders: number;
  stage: LabStage;
  /** Only ever set once every order at this office has been approved. */
  verdict: "pass" | "fail" | null;
};

/**
 * Testing progress for one application, per destination office.
 *
 * Per office because that is how the applicant experiences it — he carries a
 * box to each — and because one office finishing tells the FDO something real
 * while the others are still running.
 */
export async function labProgressFor(applicationId: number): Promise<{
  destinations: DestinationProgress[];
  stage: LabStage;
  verdict: "pass" | "fail" | null;
}> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      testFeePayment: { select: { status: true } },
      consignments: {
        select: {
          code: true,
          sealNo: true,
          state: true,
          officeId: true,
          office: { select: { nameEn: true } },
          registry: {
            select: {
              sample: {
                select: {
                  labTestOrder: {
                    select: {
                      id: true,
                      state: true,
                      report: { select: { reportNo: true, verdict: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!app) return { destinations: [], stage: "fee_unpaid", verdict: null };

  const feePaid = app.testFeePayment?.status === "paid";

  const destinations: DestinationProgress[] = app.consignments.map((c) => {
    // One box can hold specimens from several orders; de-duplicate by order id.
    const orders = new Map<number, { state: string; reportNo: string | null; verdict: string }>();
    for (const r of c.registry) {
      const o = r.sample.labTestOrder;
      orders.set(o.id, {
        state: o.state,
        reportNo: o.report?.reportNo ?? null,
        verdict: o.report?.verdict ?? "not_tested",
      });
    }
    const all = [...orders.values()];
    const approved = all.filter((o) => o.state === "reported" && o.reportNo);

    const stage: LabStage = !feePaid
      ? "fee_unpaid"
      : approved.length === all.length && all.length > 0
        ? "reported"
        : all.some((o) => o.state !== "awaiting_sample")
          ? // Any order past `awaiting_sample` means the wing has taken the
            // samples in; `in_progress` and everything above it is testing.
            all.every((o) => o.state === "received")
            ? "with_wing"
            : "testing"
          : c.state === "submitted" || c.state === "received_at_lab"
            ? "with_counter"
            : "awaiting_submission";

    return {
      officeId: c.officeId,
      officeName: c.office?.nameEn ?? "—",
      consignmentCode: c.code,
      sealNo: c.sealNo,
      boxState: c.state,
      reported: approved.length,
      orders: all.length,
      stage,
      verdict:
        approved.length === all.length && all.length > 0
          ? approved.some((o) => o.verdict === "fail")
            ? "fail"
            : "pass"
          : null,
    };
  });

  // The file's own stage is the **least advanced** destination: a file is not
  // tested until every laboratory has reported, the same rule that makes
  // `sample_received` the last box rather than the first (D73).
  const ORDER: LabStage[] = [
    "fee_unpaid",
    "awaiting_submission",
    "with_counter",
    "with_wing",
    "testing",
    "reported",
  ];
  const stage = destinations.length
    ? destinations.reduce<LabStage>(
        (min, d) => (ORDER.indexOf(d.stage) < ORDER.indexOf(min) ? d.stage : min),
        "reported",
      )
    : feePaid
      ? "awaiting_submission"
      : "fee_unpaid";

  const verdict =
    stage === "reported"
      ? destinations.some((d) => d.verdict === "fail")
        ? ("fail" as const)
        : ("pass" as const)
      : null;

  return { destinations, stage, verdict };
}

/**
 * Bring the application's state into line with its testing.
 *
 * **The lab never writes this.** `lib/labs/` knows nothing about applications
 * and must not learn; this runs on the CM side after a lab act, reads the
 * progress above and sets the state the FDO is shown. Keeping the write here
 * is what stops an accidental `include` in the lab module from reaching an
 * applicant.
 *
 * Only ever moves the file **forward** through the testing states, and never
 * touches one that has moved past them — a file somebody has since decided on
 * is not ours to rewind.
 */
export async function syncLabState(applicationId: number) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { state: true },
  });
  if (!app) return null;

  const MOVEABLE = [
    "test_fee_paid",
    "sample_partially_received",
    "sample_received",
    "lab_testing",
    "lab_test_passed",
    "lab_test_failed",
  ];
  if (!MOVEABLE.includes(app.state)) return app.state;

  const { stage, verdict } = await labProgressFor(applicationId);
  const next =
    stage === "reported"
      ? verdict === "fail"
        ? "lab_test_failed"
        : "lab_test_passed"
      : stage === "testing" || stage === "with_wing"
        ? "lab_testing"
        : null;

  if (!next || next === app.state) return app.state;
  await prisma.application.update({ where: { id: applicationId }, data: { state: next } });
  return next;
}

/**
 * The application a test order belongs to — **the deliberate crossing**, used
 * only to keep the file's state in step after a lab act.
 *
 * Named so it is greppable. Anything else reaching from an order to an
 * application should be looked at twice.
 */
export async function applicationIdForOrder(orderId: number): Promise<number | null> {
  const reg = await prisma.sampleRegistration.findFirst({
    where: { sample: { labTestOrderId: orderId } },
    select: { consignment: { select: { applicationId: true } } },
  });
  return reg?.consignment.applicationId ?? null;
}
