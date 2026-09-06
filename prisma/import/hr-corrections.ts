/**
 * One-off corrections to the roster that the HR export cannot supply.
 *
 *   npm run import:hr-corrections -- --dry    report only, no writes
 *   npm run import:hr-corrections             apply
 *
 * **Why this exists as a script rather than a hand-edit.** The export is the
 * roster's source of truth and is re-imported; where a fact contradicts it, the
 * contradiction has to be written down somewhere that survives the next import
 * and says who decided. That is this file. Each entry carries the reason, and
 * the script is idempotent — it states a target and moves the row to it, so a
 * re-run after a refresh re-asserts the correction.
 *
 * **These two came from the client on 2026-09-05**, in answer to "why can a
 * Deputy Director not see Kawser Ahmed Khan in the forward dropdown".
 *
 * 1. **Md. Golam Rabbani has retired.** The export still lists him as a serving
 *    উপপরিচালক, so `import:retire` — which only removes people the export does
 *    *not* contain — would never catch him. He held `office_head` for Head
 *    Office and the Deputy Director (CM) desk in CM Dhaka, so an office's files
 *    were arriving at somebody who had left. Status, desk and role move
 *    together for that reason. The row is kept rather than deleted: deleting an
 *    Employee cascades to postings, fixations and processed salary.
 *
 * 2. **Md. Alauddin Hussain is a Deputy Director (CM) on grade 6, acting as
 *    Director (CM).** The export recorded him as পরিচালক on grade 4 — that is
 *    the *charge* showing through, not his substantive rank, which is exactly
 *    the confusion `Employee.actingOrgPostId` exists to end. He takes the DD
 *    (CM) desk Golam Rabbani vacates, holds the vacant Director post in
 *    additional charge, and becomes Head Office's `office_head`.
 *
 *    His `nameEn` also held the Bangla name: the HR detail API returned 500 for
 *    his record, so the row fell back to the preview, and the export's own
 *    `conflicts` array records the scraped `name_en` as "Md. Alauddin Hussain".
 *
 * 4. **The two testing wings' Directors**, given 2026-09-06. Md Shahadat Hossain
 *    has retired from Director (Physics); Mobin Ul Islam holds it now and his
 *    designation is Director (Physical). Gazi Md. Nurul Islam is the Chemical
 *    wing's Director and was never seated — `import:desks` matched his recorded
 *    wing to a leaf section rather than to the wing root where the Director post
 *    sits, so the post read vacant while the man was on the roster.
 *
 *    This is why `wingHeadForLab()` (D94) reads the *post*: with the data as it
 *    was, the Physical wing held two grade-4 Directors — one retired, one on a
 *    Deputy Director (Textile) desk — and no seniority rule could have told
 *    which was the Director. Asking the post did not resolve it either; it
 *    made the wrong answer *visible*, which is what let it be corrected.
 *
 * 3. **The CM wing's two Deputy Director seats go to the other two DDs** —
 *    Kawser Ahmed Khan to CM Dhaka, Mohammad Arafat Hossain Sarker to Training.
 *    Client's instruction, 2026-09-05.
 *
 *    **So Md. Alauddin Hussain gives up his substantive desk and holds only the
 *    Director post in charge.** Three serving Deputy Directors against two
 *    sanctioned DD seats is one too many, and the third seat he actually
 *    occupies is the Director's — which is what the charge means. That keeps
 *    every post inside its sanctioned count instead of over-allocating one, the
 *    discipline `import:desks` follows. It costs him nothing in the workflow:
 *    `toDesk()` reads the acting post first, so he keeps section 212 and grade
 *    4. If the charge ends, he needs a DD seat back.
 */
import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const DRY = process.argv.includes("--dry");

/** Deputy Director (CM), unit "CM Dhaka" — the CM section's own DD desk. */
const DD_CM_POST = 672;
/** Deputy Director (CM), unit "Training". The wing's other DD seat. */
const DD_CM_TRAINING_POST = 666;
/** Director, unit "Executive (Certification Marks Wing)" — vacant, held in charge. */
const DIR_CM_POST = 662;

const RETIRED = "19953010019";
const ACTING = "19953010017";

/** Director (Physics), Executive (Physical Testing Wing). */
const DIR_PHYSICS_POST = 682;
/** Director (Chemistry), Executive (Chemical Testing Wing). */
const DIR_CHEMISTRY_POST = 728;

const PHYSICS_RETIRED = "19984010027"; // Md Shahadat Hossain
const PHYSICS_DIRECTOR = "19984010029"; // Mobin Ul Islam
const CHEMISTRY_DIRECTOR = "19945010033"; // Gazi Md. Nurul Islam
/** Kawser Ahmed Khan → the CM Dhaka DD seat. */
const DD_CM_DHAKA = "20063010031";
/** Mohammad Arafat Hossain Sarker → the Training DD seat. */
const DD_TRAINING = "20063010035";

const EVERYONE = [
  RETIRED, ACTING, DD_CM_DHAKA, DD_TRAINING,
  PHYSICS_RETIRED, PHYSICS_DIRECTOR, CHEMISTRY_DIRECTOR,
];

async function main() {
  const before = await prisma.employee.findMany({
    where: { id: { in: EVERYONE } },
    select: {
      id: true, nameEn: true, grade: true, designationEn: true, status: true,
      orgPostId: true, actingOrgPostId: true, user: { select: { role: true } },
    },
    orderBy: { id: "asc" },
  });
  console.log("Before:");
  for (const e of before) console.log(`  ${JSON.stringify(e)}`);

  // Guard: the desks named here must be the ones intended, so a renumbered
  // organogram fails loudly instead of seating somebody on a stranger's post.
  const posts = await prisma.orgPost.findMany({
    where: { id: { in: [DD_CM_POST, DD_CM_TRAINING_POST, DIR_CM_POST] } },
    select: { id: true, nameEn: true, grade: true, unit: { select: { nameEn: true } } },
  });
  const dd = posts.find((p) => p.id === DD_CM_POST);
  const training = posts.find((p) => p.id === DD_CM_TRAINING_POST);
  const dir = posts.find((p) => p.id === DIR_CM_POST);
  if (dd?.nameEn !== "Deputy Director (CM)" || dd.unit.nameEn !== "CM Dhaka") {
    throw new Error(`post ${DD_CM_POST} is not Deputy Director (CM) in CM Dhaka: ${JSON.stringify(dd)}`);
  }
  if (training?.nameEn !== "Deputy Director (CM)" || training.unit.nameEn !== "Training") {
    throw new Error(`post ${DD_CM_TRAINING_POST} is not Deputy Director (CM) in Training: ${JSON.stringify(training)}`);
  }
  if (dir?.nameEn !== "Director" || !dir.unit.nameEn.includes("Certification Marks")) {
    throw new Error(`post ${DIR_CM_POST} is not the CM wing Director post: ${JSON.stringify(dir)}`);
  }

  const wingPosts = await prisma.orgPost.findMany({
    where: { id: { in: [DIR_PHYSICS_POST, DIR_CHEMISTRY_POST] } },
    select: { id: true, nameEn: true },
  });
  const phys = wingPosts.find((p) => p.id === DIR_PHYSICS_POST);
  const chem = wingPosts.find((p) => p.id === DIR_CHEMISTRY_POST);
  if (phys?.nameEn !== "Director (Physics)" || chem?.nameEn !== "Director (Chemistry)") {
    throw new Error(
      `posts ${DIR_PHYSICS_POST}/${DIR_CHEMISTRY_POST} are not the testing wing Director posts`,
    );
  }

  if (DRY) {
    console.log("\n--dry: nothing written.");
    console.log(`  ${RETIRED} → status retired, desk released, role employee`);
    console.log(`  ${ACTING}  → grade 6, Deputy Director, no substantive desk, acting ${DIR_CM_POST}, role office_head`);
    console.log(`  ${DD_CM_DHAKA} → desk ${DD_CM_POST} (Deputy Director (CM), CM Dhaka)`);
    console.log(`  ${DD_TRAINING} → desk ${DD_CM_TRAINING_POST} (Deputy Director (CM), Training)`);
    console.log(`  ${PHYSICS_RETIRED} → status retired, desk released`);
    console.log(`  ${PHYSICS_DIRECTOR} → desk ${DIR_PHYSICS_POST}, designation Director (Physical)`);
    console.log(`  ${CHEMISTRY_DIRECTOR} → desk ${DIR_CHEMISTRY_POST}`);
    return;
  }

  await prisma.$transaction([
    prisma.employee.update({
      where: { id: RETIRED },
      data: { status: "retired", orgPostId: null, actingOrgPostId: null },
    }),
    prisma.user.update({ where: { id: `user_${RETIRED}` }, data: { role: "employee" } }),
    prisma.employee.update({
      where: { id: ACTING },
      data: {
        nameEn: "Md. Alauddin Hussain",
        designationEn: "Deputy Director",
        designationBn: "উপপরিচালক",
        grade: "6",
        // The seat he would hold goes to Kawser Ahmed Khan; the post he actually
        // occupies is the Director's, in charge. See note 3 above.
        orgPostId: null,
        actingOrgPostId: DIR_CM_POST,
      },
    }),
    prisma.user.update({ where: { id: `user_${ACTING}` }, data: { role: "office_head" } }),

    prisma.employee.update({ where: { id: DD_CM_DHAKA }, data: { orgPostId: DD_CM_POST } }),
    prisma.employee.update({ where: { id: DD_TRAINING }, data: { orgPostId: DD_CM_TRAINING_POST } }),

    // The Physics desk is vacated before it is refilled: one seat, one holder,
    // and `sanctionedCount` is 1.
    prisma.employee.update({
      where: { id: PHYSICS_RETIRED },
      data: { status: "retired", orgPostId: null, actingOrgPostId: null },
    }),
    prisma.employee.update({
      where: { id: PHYSICS_DIRECTOR },
      data: {
        orgPostId: DIR_PHYSICS_POST,
        designationEn: "Director (Physical)",
        designationBn: "পরিচালক (পদার্থ)",
      },
    }),
    // Never seated: his wing name matched a leaf section, not the wing root
    // where the Director post lives.
    prisma.employee.update({
      where: { id: CHEMISTRY_DIRECTOR },
      data: { orgPostId: DIR_CHEMISTRY_POST },
    }),
  ]);

  const after = await prisma.employee.findMany({
    where: { id: { in: EVERYONE } },
    select: {
      id: true, nameEn: true, grade: true, designationEn: true, status: true,
      orgPost: { select: { id: true, nameEn: true, grade: true, unit: { select: { nameEn: true } } } },
      actingOrgPost: { select: { id: true, nameEn: true, grade: true } },
      user: { select: { role: true } },
    },
    orderBy: { id: "asc" },
  });
  console.log("\nAfter:");
  for (const e of after) console.log(`  ${JSON.stringify(e)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
