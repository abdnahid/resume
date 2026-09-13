/**
 * Bring letters issued before D128/D129 up to the current rule.
 *
 *     npm run fix:sample-letters -- --dry
 *
 * Two things changed on 2026-09-13, after some files had already had their
 * letters issued:
 *
 * - **The applicant gets one letter per destination office** (D128), not one
 *   compiled letter describing every journey. A file issued under the old rule
 *   holds a single `applicant` row with no office on it.
 * - **Issuing the letters demands the testing fee** (D129): the state becomes
 *   `test_fee_demanded` and `testFeePoisha` is snapshotted. A file issued
 *   before that sits in whatever state it reached and has no figure.
 *
 * The original letter keeps its number and becomes the letter for the first
 * destination; the others are numbered on from the office's own series, exactly
 * as a fresh dispatch would be. Numbers are never reused and never reordered —
 * a number that has been on paper means one thing for ever.
 *
 * It also repairs the wing-head letters (D130), which carried their destination
 * **office** id in `labId` — a column whose foreign key points at `Lab`. Office
 * ids run 1-23 against lab ids 1-46, so every one of them was a valid lab id
 * and the database took it without complaint; read back, the letter to Khulna's
 * wing head named *Physical Lab, Barisal*. The id is moved to `officeId`, where
 * it says what it is, and `labId` is cleared: no laboratory was ever chosen.
 *
 * Idempotent: a file already holding one applicant letter per box is left
 * alone, and so is one whose fee has already been demanded or paid.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { testFeeFor } from "@/lib/cm/sub-products";

const DRY = process.argv.includes("--dry");
const taka = (p: number) => `৳${(p / 100).toLocaleString("en-BD")}`;

async function main() {
  const apps = await prisma.application.findMany({
    where: { letters: { some: { kind: "applicant" } } },
    select: {
      id: true, applicationNo: true, state: true,
      testFeePoisha: true, testFeePayment: { select: { status: true } },
      bstiOfficeId: true,
      letters: {
        where: { kind: "applicant" },
        select: { id: true, letterNo: true, officeId: true, issuedByEmployeeId: true, issuedAt: true },
        orderBy: { id: "asc" },
      },
      consignments: {
        select: { officeId: true, office: { select: { nameEn: true } } },
        orderBy: { id: "asc" },
      },
    },
  });

  // D130 — the wing-head letters that name no office.
  //
  // **The number in `labId` is not reinterpreted**, because it does not mean
  // the same thing on every row. The code immediately before D130 put the
  // destination *office* id there, and the code before that put a real lab id;
  // both fit, since office ids run 1-23 inside lab ids 1-46. Reading row one as
  // an office would have moved a Dhaka letter to Barishal.
  //
  // So the office comes from **the officer it was addressed to**, which is the
  // one unambiguous fact on the row, cross-checked against the boxes the file
  // actually has. `labId` is cleared either way: no laboratory was ever chosen
  // — the office decides that, and may send the work outside (D116).
  const stale = await prisma.sampleLetter.findMany({
    where: { kind: "wing_head", officeId: null },
    select: {
      id: true, letterNo: true, labId: true, applicationId: true,
      addressedTo: {
        select: {
          nameEn: true, officeId: true,
          postings: { where: { relievedAt: null }, select: { officeId: true }, take: 1 },
        },
      },
      application: { select: { consignments: { select: { officeId: true } } } },
    },
    orderBy: { id: "asc" },
  });

  let repaired = 0;
  if (stale.length) console.log(`\nwing-head letters naming no office: ${stale.length}`);
  for (const l of stale) {
    const officeId = l.addressedTo?.postings[0]?.officeId ?? l.addressedTo?.officeId ?? null;
    const boxes = l.application.consignments
      .map((c) => c.officeId)
      .filter((x): x is number => x !== null);
    const office = officeId
      ? await prisma.office.findUnique({ where: { id: officeId }, select: { nameEn: true } })
      : null;

    if (!officeId || !boxes.includes(officeId)) {
      // Said out loud rather than guessed. A letter pointed at an office with
      // no box for it is a letter somebody has to look at.
      console.log(
        `   ${l.letterNo}  ✗ ${l.addressedTo?.nameEn ?? "nobody"} sits at office ${officeId ?? "—"}, ` +
          `which has no box on this file (boxes: ${boxes.join(", ") || "none"}) — left alone`,
      );
      continue;
    }
    console.log(`   ${l.letterNo}  labId=${l.labId ?? "-"} → office ${officeId} ${office?.nameEn} (${l.addressedTo?.nameEn})`);
    if (!DRY) {
      await prisma.sampleLetter.update({
        where: { id: l.id },
        data: { officeId, labId: null },
      });
    }
    repaired++;
  }

  let splits = 0, demands = 0;
  for (const a of apps) {
    const offices = [...new Set(a.consignments.map((c) => c.officeId).filter((x): x is number => x !== null))];
    const covered = new Set(a.letters.map((l) => l.officeId).filter((x): x is number => x !== null));
    const missing = offices.filter((o) => !covered.has(o));
    const orphan = a.letters.find((l) => l.officeId === null);

    // `testFeeFor()` is the only place a test fee is added up, provisional and
    // final alike, so a backfilled snapshot cannot disagree with a fresh one.
    const fee = (await testFeeFor(a.id)).totalPoisha;
    const needsDemand =
      a.testFeePayment?.status !== "paid" && a.testFeePoisha === null && offices.length > 0;

    if (!orphan && !missing.length && !needsDemand) continue;

    console.log(`\n${a.applicationNo ?? `#${a.id}`}  state=${a.state}`);
    console.log(`   boxes: ${a.consignments.map((c) => c.office?.nameEn?.split(",").pop()?.trim()).join(", ")}`);
    console.log(`   applicant letters: ${a.letters.length} (${orphan ? "one compiled" : "per office"})`);
    if (missing.length)
      console.log(`   → ${orphan ? "the compiled letter becomes" : "adding"} ${missing.length} per-office letter(s)`);
    if (needsDemand) console.log(`   → testing fee demanded at ${taka(fee)}`);

    if (DRY) continue;

    // The original keeps its number and takes the first destination.
    if (orphan && missing.length) {
      await prisma.sampleLetter.update({
        where: { id: orphan.id },
        data: { officeId: missing[0] },
      });
      splits++;
      for (const officeId of missing.slice(1)) {
        const { prefix, suffix, next } = await nextLetterSerial(a.bstiOfficeId);
        await prisma.sampleLetter.create({
          data: {
            applicationId: a.id,
            kind: "applicant",
            officeId,
            letterNo: `${prefix}${String(next).padStart(4, "0")}${suffix}`,
            issuedByEmployeeId: orphan.issuedByEmployeeId,
            issuedAt: orphan.issuedAt,
          },
        });
        splits++;
      }
    }

    if (needsDemand) {
      await prisma.application.update({
        where: { id: a.id },
        data: {
          testFeePoisha: fee,
          // Only move a file that has not gone past this point under its own
          // steam. A state later in the flow is somebody's decision, not ours.
          ...(a.state === "inspection_completed" || a.state === "inspection_report_submitted"
            ? { state: "test_fee_demanded" as const }
            : {}),
        },
      });
      demands++;
    }
  }

  if (DRY) { console.log(`\n--dry: nothing written.`); return; }
  console.log(
    `\n✓ ${splits} applicant letter(s) now name an office; ${demands} fee demand(s) raised; ` +
      `${repaired} wing-head letter(s) repaired`,
  );
}

/** The office's letter series, continued. Mirrors `lib/cm/letters.ts`. */
async function nextLetterSerial(officeId: number | null) {
  const year = new Date().getFullYear();
  const office = officeId
    ? await prisma.office.findUnique({ where: { id: officeId }, select: { nameBn: true } })
    : null;
  const label = (office?.nameBn ?? "ঢাকা").split(",").map((x) => x.trim()).filter(Boolean).pop() ?? "ঢাকা";
  const prefix = `বিএসটিআই/${label}/নমুনা/`;
  const suffix = `/${year}`;
  const rows = await prisma.sampleLetter.findMany({
    where: { letterNo: { startsWith: prefix, endsWith: suffix } },
    select: { letterNo: true },
  });
  const highest = rows.reduce((max, r) => {
    const n = Number(r.letterNo.slice(prefix.length).split("/")[0]);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return { prefix, suffix, next: highest + 1 };
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
