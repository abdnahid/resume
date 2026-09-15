/**
 * Rewind one CM file to the moment before its sampling letters went out.
 *
 * `npm run fix:rewind-letters -- CM-2026-000026` reports; add `--yes` to write.
 *
 * **Why a script and not a screen.** Nothing in the workflow un-issues a
 * letter, and nothing should: a letter is a numbered document that left the
 * office, and the CM flow has no reverse gear by design. This exists for
 * walking the flow again during development, which is the same reason the dev
 * account switcher exists — and it carries the same warning. **Delete it, or
 * refuse to run it, once the module is live.**
 *
 * **What "before the letters" means**, read off `issueSampleLetters()` rather
 * than guessed: that call is the only writer of `SampleLetter`, and in one
 * transaction it creates the letters, stamps `testFeePoisha`/`isUrgent` and
 * moves the file to `test_fee_demanded` (D129, D134). So the state before it is
 * `inspection_completed` — what `approveReport()` leaves — with no letters, no
 * fee figure and no fee payment.
 *
 * **The sealing is kept, and that is the whole point of the cut.**
 * `commitSampling()` runs *before* the letters: it creates the boxes, the
 * specimens, the registrations and the `LabTestOrder`s. Rewinding past that
 * would throw away the sampling plan the officer entered by hand and force the
 * whole visit to be re-done. So consignments, samples, registrations, orders,
 * order items and the `packed` custody events all stay exactly as they are.
 *
 * **Anything that happened after the letters is undone**, because it could not
 * have happened without them: the testing fee payment (a box cannot be received
 * until it is paid, D129), any box handed in at a counter, any samples the wing
 * took in, results, referrals and reports.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";

const args = process.argv.slice(2);
const write = args.includes("--yes");
const applicationNo = args.find((a) => !a.startsWith("--"));

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
  say();

  say("WILL RESET");
  say(`  application → state inspection_completed, testFeePoisha null, isUrgent false, no fee payment`);
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
  say();

  say("WILL KEEP (sealing precedes the letters)");
  say(`  ${boxes.length} consignment${boxes.length === 1 ? "" : "s"}, ${regs.length} specimen${regs.length === 1 ? "" : "s"}, ${orders.length} test order${orders.length === 1 ? "" : "s"} and their parameters`);
  say(`  the inspection report and its approval`);
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
  say("DONE");
  say(`  state ${after.state} · testFeePoisha ${after.testFeePoisha ?? "null"} · urgent ${after.isUrgent} · feePayment ${after.testFeePaymentId ?? "null"}`);
  say(`  letters ${after._count.letters} · consignments kept ${after._count.consignments}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
