/**
 * Rewind one CM file to an earlier moment in its visit.
 *
 * `npm run fix:rewind-letters -- CM-2026-000026 --to=sampling` reports; add
 * `--yes` to write. Three depths, each a real moment in the flow:
 *
 * | `--to=` | lands at | keeps |
 * |---|---|---|
 * | `letters` (default) | the FDO about to issue the sampling letters | the sealing, the approved report |
 * | `report` | the FDO writing the visit's two documents | the sealing |
 * | `sampling` | the FDO choosing destinations and counts | the plan he typed |
 *
 * **`inspection_completed` is two different moments**, which is why the depth
 * cannot be read off the state. `approveReport()` sets it when it hands the
 * file back for the letters, and `returnVisitToOfficer()` sets it when a senior
 * sends the paperwork down to be fixed. What tells them apart is
 * `InspectionReport.submittedAt` / `approvedAt` — D96's "the visit produces two
 * documents, and one of them has no state", read from the other end.
 *
 * **Why a script and not a screen.** Nothing in the workflow un-issues a
 * letter, and nothing should: a letter is a numbered document that left the
 * office, and the CM flow has no reverse gear by design. This exists for
 * walking the flow again during development, which is the same reason the dev
 * account switcher exists — and it carries the same warning. **Delete it, or
 * refuse to run it, once the module is live.**
 *
 * **Each depth is read off the call that made the moment**, not guessed:
 *
 * - `issueSampleLetters()` is the only writer of `SampleLetter`, and in one
 *   transaction it creates the letters, stamps `testFeePoisha`/`isUrgent` and
 *   moves the file to `test_fee_demanded` (D129, D134).
 * - `submitVisit()` stamps `submittedAt` and sends the file up; `approveReport()`
 *   stamps `approvedAt`, mints the report number and hands it back down.
 * - `commitSampling()` creates the boxes, the specimens, the registrations and
 *   the `LabTestOrder`s — and refuses to run twice, so those rows are exactly
 *   what has to go before an officer can seal again.
 *
 * **What the deepest rewind does *not* destroy is the plan itself.** The
 * destinations and the counts per variant live on `SampleRequirement` and
 * `OfficeSampleRequirement`, not on the boxes, so unsealing returns the officer
 * to a filled-in sampling panel rather than a blank one. Sealing again mints
 * fresh box, seal, specimen and order codes — the old ones are not reused,
 * which is right: they were printed on labels.
 *
 * **Anything downstream of the cut is undone**, because none of it could have
 * happened without the step being removed: the testing fee payment (a box
 * cannot be received until it is paid, D129), boxes handed in at a counter,
 * samples a wing took in, results, referrals and reports.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";

const STAGES = ["letters", "report", "sampling"] as const;
type Stage = (typeof STAGES)[number];

const args = process.argv.slice(2);
const write = args.includes("--yes");
const applicationNo = args.find((a) => !a.startsWith("--"));
const stageArg = (args.find((a) => a.startsWith("--to="))?.slice(5) ?? "letters") as Stage;
if (!STAGES.includes(stageArg)) {
  throw new Error(`--to must be one of ${STAGES.join(", ")}.`);
}
/** Depth, so each stage can ask "am I at least this far back?". */
const depth = STAGES.indexOf(stageArg);
const undoesReport = depth >= 1;
const unseals = depth >= 2;

function say(s = "") {
  console.log(s);
}

async function main() {
  if (!applicationNo) {
    throw new Error("Which file? e.g. npm run fix:rewind-letters -- CM-2026-000026");
  }

  const app = await prisma.application.findFirst({
    where: { applicationNo },
    select: {
      id: true, applicationNo: true, state: true, isUrgent: true,
      testFeePoisha: true, testFeePaymentId: true,
      organization: { select: { nameEn: true } },
      inspectionReport: { select: { approvedAt: true } },
    },
  });
  if (!app) throw new Error(`No application ${applicationNo}.`);

  say(`${app.applicationNo} — ${app.organization?.nameEn ?? "?"}`);
  say(`  state ${app.state} · testFeePoisha ${app.testFeePoisha ?? "null"} · urgent ${app.isUrgent}`);
  say(`  rewinding to: ${stageArg}`);
  say();

  // **Refuse on a file that never got this far**, rather than silently doing
  // nothing: an approved inspection report is what `issueSampleLetters()`
  // demands, so a file without one was never at the moment we are rewinding to.
  if (!app.inspectionReport?.approvedAt) {
    throw new Error(
      "This file has no approved inspection report, so it has never reached letter issue. Nothing to rewind.",
    );
  }

  const letters = await prisma.sampleLetter.findMany({
    where: { applicationId: app.id },
    select: { id: true, kind: true, letterNo: true },
    orderBy: { id: "asc" },
  });

  const boxes = await prisma.consignment.findMany({
    where: { applicationId: app.id },
    select: {
      id: true, code: true, state: true, submittedAt: true, openedAt: true,
      custody: { select: { id: true, state: true } },
    },
    orderBy: { id: "asc" },
  });

  // The crossing D133 named: consignment → registration → sample → order.
  const regs = await prisma.sampleRegistration.findMany({
    where: { consignment: { applicationId: app.id } },
    select: { sample: { select: { id: true, state: true, labTestOrderId: true } } },
  });
  const orderIds = [...new Set(regs.map((r) => r.sample.labTestOrderId))];
  const orders = await prisma.labTestOrder.findMany({
    where: { id: { in: orderIds } },
    select: {
      id: true, code: true, state: true, isUrgent: true,
      receivedByWingAt: true, holderEmployeeId: true, holderRung: true, reportedAt: true,
      _count: { select: { movements: true, referrals: true } },
      report: { select: { id: true } },
      items: { select: { id: true, _count: { select: { results: true } } } },
    },
    orderBy: { id: "asc" },
  });

  const resultCount = orders.reduce(
    (n, o) => n + o.items.reduce((m, i) => m + i._count.results, 0),
    0,
  );
  const referralCount = orders.reduce((n, o) => n + o._count.referrals, 0);
  const movementCount = orders.reduce((n, o) => n + o._count.movements, 0);
  const reportCount = orders.filter((o) => o.report).length;

  // Custody events that record a box being handed in or later — everything
  // after `packed`, which is what sealing wrote and what must survive.
  const laterCustody = boxes.flatMap((b) =>
    b.custody.filter((c) => c.state !== "packed").map((c) => ({ ...c, box: b.code })),
  );
  const submittedSamples = regs.filter((r) => r.sample.state !== "sealed");

  // The report's own two stamps, and every movement the file made from the
  // moment it went up. Identified by time rather than by the note's wording,
  // because a custom note replaces the default one and a string match would
  // then miss the row it was meant to find.
  const report = await prisma.inspectionReport.findUnique({
    where: { applicationId: app.id },
    select: {
      id: true, reportNo: true, submittedAt: true, approvedAt: true,
      preparedByEmployeeId: true,
      preparedBy: { select: { nameEn: true } },
      approvedBy: { select: { nameEn: true } },
    },
  });
  const sinceSubmitted =
    undoesReport && report?.submittedAt
      ? await prisma.applicationMovement.findMany({
          where: {
            applicationId: app.id,
            createdAt: { gte: new Date(report.submittedAt.getTime() - 5000) },
          },
          select: {
            id: true, direction: true, note: true,
            fromEmployee: { select: { nameEn: true } },
            toEmployee: { select: { nameEn: true } },
          },
          orderBy: { id: "asc" },
        })
      : [];

  say("WILL DELETE");
  say(`  ${letters.length} sampling letter${letters.length === 1 ? "" : "s"}`);
  for (const l of letters) say(`      ${l.kind.padEnd(10)} ${l.letterNo}`);
  say(`  ${app.testFeePaymentId ? 1 : 0} testing-fee payment${app.testFeePaymentId ? ` (id ${app.testFeePaymentId}) and its events` : ""}`);
  say(`  ${laterCustody.length} custody event${laterCustody.length === 1 ? "" : "s"} after sealing`);
  for (const c of laterCustody) say(`      ${c.box} · ${c.state}`);
  say(`  ${resultCount} test result${resultCount === 1 ? "" : "s"}`);
  say(`  ${referralCount} referral${referralCount === 1 ? "" : "s"}`);
  say(`  ${reportCount} test report${reportCount === 1 ? "" : "s"}`);
  say(`  ${movementCount} lab movement${movementCount === 1 ? "" : "s"}`);
  if (undoesReport) {
    say(`  ${sinceSubmitted.length} file movement${sinceSubmitted.length === 1 ? "" : "s"} from the report going up`);
    for (const m of sinceSubmitted)
      say(`      ${m.direction.padEnd(5)} ${m.fromEmployee?.nameEn ?? "—"} → ${m.toEmployee?.nameEn ?? "—"}`);
  }
  if (unseals) {
    say(`  ${boxes.length} consignment${boxes.length === 1 ? "" : "s"} and every custody event`);
    for (const b of boxes) say(`      ${b.code}`);
    say(`  ${regs.length} specimen${regs.length === 1 ? "" : "s"} and their registrations`);
    say(`  ${orders.length} test order${orders.length === 1 ? "" : "s"} and their parameters`);
    for (const o of orders) say(`      ${o.code}`);
  }
  say();

  say("WILL RESET");
  say(`  application → state inspection_completed, testFeePoisha null, isUrgent false, no fee payment`);
  if (undoesReport && report) {
    say(`  report ${report.reportNo ?? "(unnumbered)"} → draft: no number, not submitted, not approved`);
    say(`  file → back to ${report.preparedBy?.nameEn ?? "its preparer"}, who wrote it`);
  }
  if (!unseals) {
    for (const b of boxes) {
      if (b.state !== "awaiting_submission" || b.submittedAt || b.openedAt) {
        say(`  ${b.code} → awaiting_submission (was ${b.state})`);
      }
    }
    say(`  ${submittedSamples.length} specimen${submittedSamples.length === 1 ? "" : "s"} → sealed`);
    for (const o of orders) {
      const bits: string[] = [];
      if (o.state !== "awaiting_sample") bits.push(`state ${o.state} → awaiting_sample`);
      if (o.isUrgent) bits.push("urgent → false");
      if (o.receivedByWingAt) bits.push("unreceive");
      if (o.holderEmployeeId) bits.push("clear holder");
      if (bits.length) say(`  ${o.code} → ${bits.join(", ")}`);
    }
  }
  say();

  const reqs = await prisma.sampleRequirement.count({
    where: { applicationSubProduct: { applicationId: app.id } },
  });
  say("WILL KEEP");
  if (!unseals) {
    say(`  ${boxes.length} consignment${boxes.length === 1 ? "" : "s"}, ${regs.length} specimen${regs.length === 1 ? "" : "s"}, ${orders.length} test order${orders.length === 1 ? "" : "s"} and their parameters — sealing precedes the letters`);
  } else {
    // The reason unsealing is affordable: the officer's own answers are not on
    // the boxes, so he comes back to a filled-in panel rather than a blank one.
    say(`  ${reqs} sampling requirement${reqs === 1 ? "" : "s"} — the destinations and counts he typed`);
    say(`  the sub-products and SKUs found at the factory`);
  }
  if (!undoesReport) say(`  the inspection report and its approval`);
  else say(`  the inspection report's contents — editable again`);
  say(`  the inspection plan and its office order`);
  say();

  if (!write) {
    say("Dry run. Nothing written. Re-run with --yes to apply.");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      // Order matters only where a foreign key would refuse: the application
      // points at its fee payment, so that link is broken before the payment
      // row goes.
      await tx.application.update({
        where: { id: app.id },
        data: {
          state: "inspection_completed",
          testFeePoisha: null,
          isUrgent: false,
          testFeePaymentId: null,
        },
      });

      await tx.sampleLetter.deleteMany({ where: { applicationId: app.id } });

      if (app.testFeePaymentId) {
        await tx.paymentEvent.deleteMany({ where: { paymentId: app.testFeePaymentId } });
        await tx.payment.delete({ where: { id: app.testFeePaymentId } });
      }

      // **The report's two stamps, and the file back to whoever wrote it.**
      // `submittedAt: null` is what reopens it for editing — the same thing
      // `returnVisitToOfficer()` does when a senior sends the paperwork down,
      // which is the existing act this is imitating.
      if (undoesReport && report) {
        await tx.inspectionReport.update({
          where: { id: report.id },
          data: {
            submittedAt: null,
            approvedAt: null,
            approvedByEmployeeId: null,
            reportNo: null,
          },
        });
        await tx.application.update({
          where: { id: app.id },
          data: { holderEmployeeId: report.preparedByEmployeeId },
        });
        if (sinceSubmitted.length) {
          await tx.applicationMovement.deleteMany({
            where: { id: { in: sinceSubmitted.map((m) => m.id) } },
          });
        }
      }

      if (unseals) {
        // **Deleted, not reset.** `commitSampling()` refuses to run against an
        // application that already has consignments — deliberately, so a box of
        // jars cannot be silently regenerated under the applicant's feet — so
        // the rows have to go before the officer can seal again.
        //
        // The cascades do most of it: dropping a consignment takes its
        // registrations and custody events, and dropping an order takes its
        // specimens, items, results, referrals, movements and report. Both are
        // named anyway, because relying on a cascade is relying on a schema
        // nobody re-reads.
        if (orderIds.length) {
          await tx.testResult.deleteMany({ where: { orderItem: { orderId: { in: orderIds } } } });
          await tx.labReferral.deleteMany({ where: { orderId: { in: orderIds } } });
          await tx.labTestReport.deleteMany({ where: { orderId: { in: orderIds } } });
          await tx.labTestOrderMovement.deleteMany({ where: { orderId: { in: orderIds } } });
        }
        await tx.custodyEvent.deleteMany({ where: { consignment: { applicationId: app.id } } });
        await tx.sampleRegistration.deleteMany({
          where: { consignment: { applicationId: app.id } },
        });
        await tx.consignment.deleteMany({ where: { applicationId: app.id } });
        if (orderIds.length) {
          await tx.sample.deleteMany({ where: { labTestOrderId: { in: orderIds } } });
          await tx.labTestOrderItem.deleteMany({ where: { orderId: { in: orderIds } } });
          await tx.labTestOrder.deleteMany({ where: { id: { in: orderIds } } });
        }
      } else {
        // The lab side, innermost first.
        if (orderIds.length) {
          await tx.testResult.deleteMany({ where: { orderItem: { orderId: { in: orderIds } } } });
          await tx.labReferral.deleteMany({ where: { orderId: { in: orderIds } } });
          await tx.labTestReport.deleteMany({ where: { orderId: { in: orderIds } } });
          await tx.labTestOrderMovement.deleteMany({ where: { orderId: { in: orderIds } } });
          await tx.labTestOrder.updateMany({
            where: { id: { in: orderIds } },
            data: {
              state: "awaiting_sample",
              isUrgent: false,
              holderEmployeeId: null,
              holderRung: null,
              receivedByWingAt: null,
              receivedByWingEmployeeId: null,
              reportedAt: null,
              dueOn: null,
            },
          });
        }

        await tx.custodyEvent.deleteMany({
          where: { consignment: { applicationId: app.id }, state: { not: "packed" } },
        });
        await tx.consignment.updateMany({
          where: { applicationId: app.id },
          data: {
            state: "awaiting_submission",
            submittedAt: null,
            receivedByUserId: null,
            openedAt: null,
            openedByEmployeeId: null,
            sealIntact: null,
            rejectionReason: null,
          },
        });
        await tx.sample.updateMany({
          where: { registry: { consignment: { applicationId: app.id } } },
          data: { state: "sealed" },
        });
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  );

  const after = await prisma.application.findUniqueOrThrow({
    where: { id: app.id },
    select: {
      state: true, testFeePoisha: true, isUrgent: true, testFeePaymentId: true,
      _count: { select: { letters: true, consignments: true } },
    },
  });
  const afterReport = await prisma.inspectionReport.findUnique({
    where: { applicationId: app.id },
    select: { reportNo: true, submittedAt: true, approvedAt: true },
  });
  say("DONE");
  say(`  state ${after.state} · testFeePoisha ${after.testFeePoisha ?? "null"} · urgent ${after.isUrgent} · feePayment ${after.testFeePaymentId ?? "null"}`);
  say(`  letters ${after._count.letters} · consignments ${after._count.consignments}`);
  say(
    `  report: no ${afterReport?.reportNo ?? "null"} · submitted ${afterReport?.submittedAt ?? "null"} · approved ${afterReport?.approvedAt ?? "null"}`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
