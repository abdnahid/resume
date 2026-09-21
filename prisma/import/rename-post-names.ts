/**
 * Regenerate every organogram post's English name from its Bengali one.
 *
 * `npm run fix:post-names` reports; add `--yes` to write.
 *
 * **Why this exists.** The 1983 sanctioned organogram names its posts in
 * Bengali; the English column beside it was written by hand and drifted. Two of
 * its errors were load-bearing, and both are the same mistake — the bench and
 * the field officer had their words swapped:
 *
 * | Bengali | was | is |
 * |---|---|---|
 * | পরীক্ষক | Inspector | **Examiner** |
 * | পরিদর্শক | Field Inspector | **Inspector** |
 *
 * `পরীক্ষক` rendered as *Inspector* is why the notes recorded that the
 * organogram contained no post titled Examiner while 97 employees are
 * designated one: the posts existed under the wrong English word, so no correct
 * seat could ever be found and `import:desks` matched on grade instead. Every
 * guessed seat in D149's audit descends from it.
 *
 * **Bengali is not touched.** It is the record; only the derived column is
 * rewritten, from `postNameEn()`, which the seed now calls too — so a re-seed
 * cannot put the old English back.
 *
 * **It refuses to write a name it had to guess.** Any Bengali fragment no
 * dictionary covers is reported and that post is skipped: a post title is what
 * somebody's job is called on their own screen, and a machine's best effort is
 * not good enough for it. All 144 of today's names translate cleanly.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { postNameEn } from "@/lib/org-names";

const write = process.argv.includes("--yes");

/**
 * Drop a trailing bare serial from a Bengali post name.
 *
 * Only a *bare* number in its own brackets — *(২)* — and only at the end.
 * A qualifier that happens to contain a digit is left alone, and so is
 * anything before the last bracket group.
 */
function stripSerial(bn: string): string {
  return bn.replace(/\s*\(\s*[0-9০-৯]+\s*\)\s*$/u, "").trim();
}

function say(s = "") {
  console.log(s);
}

async function main() {
  const posts = await prisma.orgPost.findMany({
    select: {
      id: true,
      nameEn: true,
      nameBn: true,
      grade: true,
      unit: { select: { nameEn: true } },
    },
    orderBy: { id: "asc" },
  });

  const changes: { id: number; from: string; to: string; bn: string }[] = [];
  const skipped: { id: number; bn: string; unknown: string[] }[] = [];
  /**
   * Bengali names carrying a bare serial — *পরিদর্শক (মেট্রোলজি) (২)*.
   *
   * **The one thing here that edits the Bengali**, on the client's instruction
   * (2026-09-21): *"There are some digits with parenthesis beside some desk.
   * Those are wrong. Remove those."* They were transcription marks
   * distinguishing two rows of the same title in one section, and
   * `sanctionedCount` already carries that number — so they say nothing and
   * they show on the organogram, which renders the Bengali.
   */
  const serials: { id: number; from: string; to: string }[] = [];

  for (const p of posts) {
    const rawBn = (p.nameBn ?? "").trim();
    const bn = stripSerial(rawBn);
    if (bn && bn !== rawBn) serials.push({ id: p.id, from: rawBn, to: bn });
    if (!bn) {
      skipped.push({ id: p.id, bn: "(blank)", unknown: ["no Bengali name to derive from"] });
      continue;
    }
    const { nameEn, unknown } = postNameEn(bn, { unitNameEn: p.unit.nameEn });
    if (unknown.length) {
      skipped.push({ id: p.id, bn, unknown });
      continue;
    }
    if (nameEn !== (p.nameEn ?? "")) {
      changes.push({ id: p.id, from: p.nameEn ?? "", to: nameEn, bn });
    }
  }

  // Grouped, because 127 rows are 41 decisions.
  const byPair = new Map<string, { from: string; to: string; bn: Set<string>; n: number }>();
  for (const c of changes) {
    const k = `${c.from} => ${c.to}`;
    if (!byPair.has(k)) byPair.set(k, { from: c.from, to: c.to, bn: new Set(), n: 0 });
    const r = byPair.get(k)!;
    r.n++;
    r.bn.add(c.bn);
  }

  say(
    `${posts.length} posts · ${changes.length} to rename · ${serials.length} Bengali serials to strip · ${skipped.length} skipped`,
  );
  say();
  if (serials.length) {
    say("Bengali serials being removed:");
    for (const x of serials) say(`  post ${x.id}  "${x.from}"  ->  "${x.to}"`);
    say();
  }
  for (const r of [...byPair.values()].sort((a, b) => b.n - a.n)) {
    say(`  ${String(r.n).padStart(3)}  "${r.from}"`);
    say(`       ->  "${r.to}"`);
    say(`           ${[...r.bn].join(" · ")}`);
  }

  if (skipped.length) {
    say();
    say("SKIPPED — a fragment no dictionary covers. Add it to lib/org-names.ts:");
    for (const s of skipped) say(`  post ${s.id}  "${s.bn}"  ->  ${s.unknown.join(" / ")}`);
  }

  if (!changes.length && !serials.length) {
    say();
    say("Nothing to do.");
    return;
  }

  if (!write) {
    say();
    say("Dry run. Add --yes to write.");
    return;
  }

  // **One `updateMany` per target name, and no wrapping transaction.**
  //
  // 126 individual updates inside one `$transaction` is the shape CLAUDE.md
  // warns about and it failed exactly as described — Prisma's interactive
  // transaction expires at 5s and round trips to Neon cost about half a second
  // each. Grouping by the name being written turns 126 round trips into one per
  // distinct title.
  //
  // **Not atomic, and that is acceptable here** where it would not be for a
  // payroll write: each group is independent, re-running is a no-op for
  // anything already renamed, and a half-finished run leaves posts correctly
  // named rather than in a state nothing can read.
  const byTarget = new Map<string, number[]>();
  for (const c of changes) {
    if (!byTarget.has(c.to)) byTarget.set(c.to, []);
    byTarget.get(c.to)!.push(c.id);
  }
  for (const [to, ids] of byTarget) {
    await prisma.orgPost.updateMany({ where: { id: { in: ids } }, data: { nameEn: to } });
  }

  // One per row: a serial is stripped from a name unique to that post, so
  // there is nothing to group by. Fifteen rows, not hundreds.
  for (const x of serials) {
    await prisma.orgPost.update({ where: { id: x.id }, data: { nameBn: x.to } });
  }

  say();
  say(
    `DONE — ${changes.length} English names rewritten, ${serials.length} Bengali serials removed.`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
