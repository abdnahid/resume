/**
 * Seats every office head on their office's Executive desk.
 *
 *   npm run import:office-head-desks -- --dry    report only, no writes
 *   npm run import:office-head-desks             seat them
 *
 * **Why this cannot be part of `import:desks`.** That importer matches
 * office → wing → grade → title, which is right for the officers who do the
 * work: an AD (CM) belongs on an AD (CM) desk in the CM section. But the head
 * of a branch office is whoever is seniormost there, *whatever wing he came
 * from* — a DD (Metrology) heads Barisal, a Director whose wing is recorded as
 * রসায়ন heads Rajshahi — and the desk he holds is the one post in the office's
 * Executive unit. Matching on his wing therefore looks for a Metrology desk
 * inside Executive and finds nothing, which is why five heads held no post at
 * all: Narayanganj, Narsingdi, Rajshahi, Bogura and Khulna. Two of those five
 * are Directors, and until `seed:grades` put Directors on grade 4 no Director
 * could be seated anywhere, because the organogram graded the post 5 and not
 * one of the nine serving Directors holds that grade.
 *
 * A head with no desk can receive a file and then not pass it on: `candidates()`
 * works from `desksOfOffice()`, and someone with no post has no section, so the
 * picker is empty and the file stops dead in his hands.
 *
 * **What is improvised, and from where.** Two heads — Narayanganj and Narsingdi
 * — are designated *Head of Office* with no grade recorded at all, which is
 * exactly why `import:office-heads` picked them and exactly why nothing could
 * seat them. Their grade is taken **from the post they are seated on**, not
 * invented: the Executive desk at both offices is Deputy Director (CM) on grade
 * 6, which is what the client says a branch head without a Director post holds.
 * The same rule fills an absent English designation. Nothing is guessed that the
 * organogram does not already state, and every such fill is listed in the
 * report rather than made quietly.
 *
 * Idempotent. It skips anyone who already holds a post, never adds to a post
 * already at its sanctioned count, and only ever fills a null `orgPostId` — so
 * a re-run cannot move someone placed by hand.
 */
import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { writeFileSync } from "node:fs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const DRY = process.argv.includes("--dry");
const REPORT = "utils/office-head-desk-report.txt";

/** The organogram writes Barisal; the office register writes Barishal. */
const CITY_ALIASES: Record<string, string> = { barishal: "barisal" };

const seniority = (g: string | null) => Number(g ?? 99);

const lines: string[] = [];
const say = (s = "") => {
  lines.push(s);
  console.log(s);
};

async function main() {
  const units = await prisma.orgUnit.findMany({
    select: { id: true, nameEn: true, nameBn: true, parentId: true, category: true },
  });
  const roots = units.filter((u) => u.parentId === null);

  // Office → the organogram root for that office. Head office is its wings and
  // has no single root, so it gets null and no Executive unit — its head is the
  // CM wing's seniormost officer, seated by `import:desks` like anyone else.
  const offices = await prisma.office.findMany({ select: { id: true, nameEn: true, type: true } });
  const officeRoot = new Map<number, number | null>();
  for (const o of offices) {
    if (o.type === "head") {
      officeRoot.set(o.id, null);
      continue;
    }
    if (o.type === "dmi") {
      officeRoot.set(o.id, roots.find((r) => r.nameEn.includes("DMI"))?.id ?? null);
      continue;
    }
    const city0 = o.nameEn.split(",").pop()!.trim().toLowerCase();
    const city = CITY_ALIASES[city0] ?? city0;
    officeRoot.set(o.id, roots.find((r) => r.nameEn.toLowerCase() === city)?.id ?? null);
  }
  const officeName = new Map(offices.map((o) => [o.id, o.nameEn]));

  const posts = await prisma.orgPost.findMany({
    select: {
      id: true, nameEn: true, nameBn: true, grade: true, sanctionedCount: true, unitId: true,
      _count: { select: { employees: true } },
    },
  });
  const postsOfUnit = new Map<number, typeof posts>();
  for (const p of posts) {
    if (!postsOfUnit.has(p.unitId)) postsOfUnit.set(p.unitId, [] as unknown as typeof posts);
    postsOfUnit.get(p.unitId)!.push(p);
  }

  const heads = await prisma.user.findMany({
    where: { role: "office_head" },
    select: { username: true },
  });
  const headIds = heads.map((h) => h.username).filter((x): x is string => !!x);

  const employees = await prisma.employee.findMany({
    where: { id: { in: headIds } },
    select: {
      id: true, nameEn: true, designationEn: true, designationBn: true, grade: true,
      orgPostId: true, officeId: true,
      postings: { where: { relievedAt: null }, select: { officeId: true }, take: 1 },
    },
  });

  type Seat = {
    employeeId: string; name: string; office: string;
    unit: string; post: string; postId: number;
    gradeFilled: string | null; designationFilled: string | null;
  };
  const seated: Seat[] = [];
  const already: string[] = [];
  const skipped: string[] = [];

  for (const e of employees) {
    const who = `${e.id} ${e.nameEn}`;
    const officeId = e.postings[0]?.officeId ?? e.officeId;
    const office = officeId ? (officeName.get(officeId) ?? `office ${officeId}`) : "—";

    if (e.orgPostId !== null) {
      already.push(`${who} — ${office} (post ${e.orgPostId})`);
      continue;
    }
    if (!officeId) {
      skipped.push(`${who} — no office on the employee or a current posting`);
      continue;
    }
    const root = officeRoot.get(officeId);
    if (root === undefined || root === null) {
      skipped.push(`${who} — ${office}: head office or no organogram root, not an Executive desk`);
      continue;
    }

    const exec = units.find((u) => u.parentId === root && /^executive\b/i.test(u.nameEn.trim()));
    if (!exec) {
      skipped.push(`${who} — ${office}: that office has no Executive unit`);
      continue;
    }

    // The seniormost vacant post in the Executive unit. Vacancy is checked so a
    // re-run can never push a post past its sanctioned count, which is how the
    // original seeding left 54 posts over-allocated.
    const seat = (postsOfUnit.get(exec.id) ?? [])
      .filter((p) => p._count.employees < p.sanctionedCount)
      .sort((a, b) => seniority(a.grade) - seniority(b.grade))[0];
    if (!seat) {
      skipped.push(`${who} — ${office}: every post in ${exec.nameEn} is already at its sanctioned count`);
      continue;
    }

    const gradeFilled = e.grade === null ? seat.grade : null;
    const designationFilled = e.designationEn === null ? seat.nameEn : null;

    seated.push({
      employeeId: e.id, name: e.nameEn, office, unit: exec.nameEn,
      post: seat.nameEn, postId: seat.id, gradeFilled, designationFilled,
    });
    seat._count.employees += 1; // so two heads of one office cannot take one seat
  }

  if (!DRY) {
    for (const s of seated) {
      await prisma.employee.update({
        where: { id: s.employeeId },
        data: {
          orgPostId: s.postId,
          ...(s.gradeFilled ? { grade: s.gradeFilled } : {}),
          ...(s.designationFilled ? { designationEn: s.designationFilled } : {}),
        },
      });
    }
  }

  say(`Office-head desks${DRY ? " — DRY RUN, nothing written" : ""}`);
  say(`  heads holding the role: ${employees.length}`);
  say(`  already seated:         ${already.length}`);
  say(`  seated by this run:     ${seated.length}`);
  say(`  could not be seated:    ${skipped.length}`);

  if (seated.length) {
    say("");
    say("Seated:");
    for (const s of seated) {
      say(`  ${s.employeeId} ${s.name}`);
      say(`      ${s.office}`);
      say(`      → ${s.post} (post ${s.postId}) in ${s.unit}`);
      if (s.gradeFilled) say(`      grade was not recorded; taken from the post: ${s.gradeFilled}`);
      if (s.designationFilled) say(`      English designation was not recorded; taken from the post: ${s.designationFilled}`);
    }
  }
  if (skipped.length) {
    say("");
    say("Not seated — each needs a human answer, not a better rule:");
    for (const s of skipped) say(`  ${s}`);
  }
  if (already.length) {
    say("");
    say("Already holding a desk, left alone:");
    for (const s of already) say(`  ${s}`);
  }

  writeFileSync(REPORT, lines.join("\n") + "\n");
  console.log(`\n→ ${REPORT}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
