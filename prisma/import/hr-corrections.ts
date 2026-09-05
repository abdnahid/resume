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
/** Director, unit "Executive (Certification Marks Wing)" — vacant, held in charge. */
const DIR_CM_POST = 662;

const RETIRED = "19953010019";
const ACTING = "19953010017";

async function main() {
  const before = await prisma.employee.findMany({
    where: { id: { in: [RETIRED, ACTING] } },
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
    where: { id: { in: [DD_CM_POST, DIR_CM_POST] } },
    select: { id: true, nameEn: true, grade: true, unit: { select: { nameEn: true } } },
  });
  const dd = posts.find((p) => p.id === DD_CM_POST);
  const dir = posts.find((p) => p.id === DIR_CM_POST);
  if (dd?.nameEn !== "Deputy Director (CM)" || dd.unit.nameEn !== "CM Dhaka") {
    throw new Error(`post ${DD_CM_POST} is not Deputy Director (CM) in CM Dhaka: ${JSON.stringify(dd)}`);
  }
  if (dir?.nameEn !== "Director" || !dir.unit.nameEn.includes("Certification Marks")) {
    throw new Error(`post ${DIR_CM_POST} is not the CM wing Director post: ${JSON.stringify(dir)}`);
  }

  if (DRY) {
    console.log("\n--dry: nothing written.");
    console.log(`  ${RETIRED} → status retired, desk released, role employee`);
    console.log(`  ${ACTING}  → grade 6, Deputy Director, desk ${DD_CM_POST}, acting ${DIR_CM_POST}, role office_head`);
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
        orgPostId: DD_CM_POST,
        actingOrgPostId: DIR_CM_POST,
      },
    }),
    prisma.user.update({ where: { id: `user_${ACTING}` }, data: { role: "office_head" } }),
  ]);

  const after = await prisma.employee.findMany({
    where: { id: { in: [RETIRED, ACTING] } },
    select: {
      id: true, nameEn: true, grade: true, designationEn: true, status: true,
      orgPost: { select: { id: true, nameEn: true, grade: true } },
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
