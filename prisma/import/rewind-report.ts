/**
 * Rewind a test report to the testing officer's bench.
 *
 * `npm run fix:rewind-report -- TO-32NC-6MPH-BMZ` reports; add `--yes` to
 * write. It undoes the submission and every signature above it, and puts the
 * order back `in_progress` on the desk of whoever ran the tests.
 *
 * **Why a script and not a screen.** The ladder has one reverse gear and it
 * belongs to the wing head: `returnReport()`, which sends a draft back with a
 * note saying what to fix. There is deliberately no way for a testing officer
 * to un-send his own work, and there should not be — a report that has gone up
 * has been read. This exists for walking the flow again during development, the
 * same reason `fix:rewind-letters` and the dev account switcher exist, and it
 * carries the same warning. **Delete it, or refuse to run it, once the module
 * is live.**
 *
 * **The cut is read off the movement log, not guessed from the state.** The
 * moment to return to is the last time the order was *delivered* to the testing
 * officer — a `down` (a pass-down, or a wing head's return) or a `receive`.
 * Every movement after that id is the submission chain being undone, and those
 * rows go. The state cannot answer this: `pending_check` is reached by a first
 * submission and by a resubmission alike, and the two have different histories
 * behind them.
 *
 * **What it restores and what it leaves alone:**
 *
 * - **Cleared:** the check, the authorisation, the approval and `reportNo` — a
 *   signature given to a draft that is being reopened is exactly what
 *   `returnReport()` clears, and for the same reason (D85's rule). Releasing
 *   the number is right rather than wasteful: `nextReportNo()` takes the
 *   highest in use and adds one, so an unused number is handed back rather
 *   than burnt.
 * - **Restored:** `returnedNote`, where the delivering movement carried one and
 *   post-dates the report row. Only `returnReport()` writes that note, and only
 *   after a report exists — so a `down` older than the report is an ordinary
 *   pass-down whose note is not a correction request and must not be shown as
 *   one.
 * - **Left alone:** `testedBy`, `testedAt`, the verdict and every `TestResult`.
 *   The readings are not being undone — the officer really did run those tests,
 *   and his results rows stay editable on his bench exactly as they were. The
 *   verdict is recomputed by the next `submitReport()`, and inventing an
 *   earlier `testedAt` to replace the one the undone submission stamped would
 *   be fabricating a time nothing recorded.
 * - **Untouched:** referrals. A test that went to an outside laboratory left
 *   the building; a rewind of our own paperwork cannot call it back (D140).
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { planForOffice } from "@/lib/labs/testing";
import { describeLabMovement } from "@/lib/labs/ladder";

const args = process.argv.slice(2);
const write = args.includes("--yes");
const code = args.find((a) => !a.startsWith("--"));

function say(s = "") {
  console.log(s);
}

async function main() {
  if (!code) {
    throw new Error("Which order? e.g. npm run fix:rewind-report -- TO-32NC-6MPH-BMZ");
  }

  const order = await prisma.labTestOrder.findFirst({
    where: { code },
    select: {
      id: true, code: true, state: true, officeId: true,
      holderEmployeeId: true, holderRung: true, reportedAt: true,
      holder: { select: { nameEn: true } },
      office: { select: { nameEn: true } },
      subProduct: { select: { nameEn: true } },
      report: {
        select: {
          id: true, reportNo: true, verdict: true, createdAt: true, returnedNote: true,
          testedByEmployeeId: true, testedAt: true,
          testedBy: { select: { nameEn: true } },
          checkedBy: { select: { nameEn: true } },
          authorisedBy: { select: { nameEn: true } },
          approvedBy: { select: { nameEn: true } },
        },
      },
    },
  });
  if (!order) throw new Error(`No test order ${code}.`);
  if (!order.officeId) throw new Error("This order names no office.");

  const report = order.report;
  if (!report) throw new Error("This order has no report, so nothing has been submitted.");
  if (!report.testedByEmployeeId) {
    throw new Error("This draft names no testing officer, so there is no bench to return it to.");
  }

  say(`${order.code} — ${order.subProduct?.nameEn ?? "?"} at ${order.office?.nameEn ?? "?"}`);
  say(`  state ${order.state} · holder ${order.holder?.nameEn ?? "none"} (${order.holderRung ?? "—"})`);
  say(
    `  report: no ${report.reportNo ?? "null"} · verdict ${report.verdict} · tested ${report.testedBy?.nameEn ?? "—"}` +
      ` · checked ${report.checkedBy?.nameEn ?? "—"} · authorised ${report.authorisedBy?.nameEn ?? "—"}` +
      ` · approved ${report.approvedBy?.nameEn ?? "—"}`,
  );
  say();

  // **Refuse where the order is already on the bench.** `in_progress` with the
  // tester holding it is the state this script produces, so running it there
  // would delete nothing and rewrite nothing — and the silence would read as
  // success.
  if (order.state === "in_progress" && order.holderEmployeeId === report.testedByEmployeeId) {
    throw new Error("This report is already on the testing officer's bench. Nothing to rewind.");
  }

  const movements = await prisma.labTestOrderMovement.findMany({
    where: { orderId: order.id },
    orderBy: { id: "asc" },
    select: {
      id: true, direction: true, note: true, createdAt: true,
      fromEmployee: { select: { nameEn: true } },
      toEmployee: { select: { nameEn: true } },
      toEmployeeId: true,
    },
  });

  // The delivery to undo back to: the last time the order arrived on the
  // tester's desk without him sending it there himself.
  const delivered = [...movements]
    .reverse()
    .find(
      (m) =>
        m.toEmployeeId === report.testedByEmployeeId &&
        (m.direction === "down" || m.direction === "receive"),
    );
  if (!delivered) {
    throw new Error(
      "The movement log has no delivery of this order to its testing officer, so there is no moment to rewind to.",
    );
  }

  const undoing = movements.filter((m) => m.id > delivered.id);
  if (!undoing.length) {
    throw new Error("Nothing has moved since the testing officer received this order.");
  }

  // Only `returnReport()` writes a note on a `down` to the tester, and only
  // once a report exists. An older pass-down's note is not a correction.
  const restoreNote =
    delivered.direction === "down" && delivered.note && delivered.createdAt > report.createdAt
      ? delivered.note
      : null;

  const { plan } = await planForOffice(order.officeId);

  say(`rewinding to movement ${delivered.id} — ${describeLabMovement({
    direction: delivered.direction,
    fromName: delivered.fromEmployee?.nameEn ?? null,
    toName: delivered.toEmployee?.nameEn ?? "?",
    note: delivered.note,
  })}`);
  say();
  say(`  ${undoing.length} movement(s) to delete:`);
  for (const m of undoing) {
    say(`    ${m.id}  ${describeLabMovement({
      direction: m.direction,
      fromName: m.fromEmployee?.nameEn ?? null,
      toName: m.toEmployee?.nameEn ?? "?",
      note: m.note,
    })}`);
  }
  say();
  say(`  order   → state in_progress · holder ${report.testedBy?.nameEn ?? "?"} (${plan.testedBy})`);
  say(`  report  → check, authorisation, approval and reportNo cleared`);
  say(`  report  → returnedNote ${restoreNote ? `restored: "${restoreNote}"` : "cleared"}`);
  say(`  kept    → tested ${report.testedBy?.nameEn ?? "?"} at ${report.testedAt?.toISOString() ?? "—"}, results, referrals`);
  say();

  if (!write) {
    say("Dry run. Add --yes to write.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.labTestOrderMovement.deleteMany({ where: { id: { in: undoing.map((m) => m.id) } } });
    await tx.labTestReport.update({
      where: { id: report.id },
      data: {
        reportNo: null,
        returnedNote: restoreNote,
        checkedByEmployeeId: null,
        checkedAt: null,
        authorisedByEmployeeId: null,
        authorisedAt: null,
        approvedByEmployeeId: null,
        approvedAt: null,
      },
    });
    await tx.labTestOrder.update({
      where: { id: order.id },
      data: {
        state: "in_progress",
        holderEmployeeId: report.testedByEmployeeId,
        holderRung: plan.testedBy,
        reportedAt: null,
      },
    });
  });

  const after = await prisma.labTestOrder.findUniqueOrThrow({
    where: { id: order.id },
    select: {
      state: true, holderRung: true, reportedAt: true,
      holder: { select: { nameEn: true } },
      _count: { select: { movements: true } },
      report: {
        select: {
          reportNo: true, returnedNote: true,
          checkedAt: true, authorisedAt: true, approvedAt: true,
          testedBy: { select: { nameEn: true } },
        },
      },
    },
  });
  say("DONE");
  say(`  state ${after.state} · holder ${after.holder?.nameEn ?? "none"} (${after.holderRung ?? "—"}) · movements ${after._count.movements}`);
  say(
    `  report: no ${after.report?.reportNo ?? "null"} · checked ${after.report?.checkedAt ?? "null"}` +
      ` · authorised ${after.report?.authorisedAt ?? "null"} · approved ${after.report?.approvedAt ?? "null"}`,
  );
  say(`  returnedNote: ${after.report?.returnedNote ?? "null"}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
