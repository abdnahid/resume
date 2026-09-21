/**
 * Build the shared job-title catalogue and point every desk and designation at
 * it (D152).
 *
 * `npm run seed:job-titles` reports; add `--yes` to write.
 *
 * **The organogram's post titles are the baseline** — the client's instruction,
 * 2026-09-21: *"Taking the organogram desk titles as baseline, make designation
 * and desk titles coming from common dataset."* They are the sanctioned ones,
 * and since D150 they are derived from the Bengali chart rather than written by
 * hand, so they are the only titles in the system with a provenance.
 *
 * **Designations join the same catalogue rather than being forced onto it.**
 * 81 distinct designations against 130 post titles, overlapping in 35. The
 * remainder are of two kinds and only one is a problem:
 *
 * - **A bare rank beside its qualified post** — *Assistant Director* (87
 *   people) where the chart has *Assistant Director (CM)*, *(Metrology)*,
 *   *(Chemical)*. That is a real distinction, not a spelling mistake: HR
 *   records the rank, the chart records the seat. Both stay in the catalogue.
 * - **The same job written differently** — *পরীক্ষক* beside *Examiner*, *Office
 *   assistant* beside *Office Assistant*. Those fold together, by `rankKey()`,
 *   which is the same comparison used everywhere else.
 *
 * **Every match is marked as a guess.** `Employee.designationIsInferred`
 * defaults true and this script never clears it — the client's own plan is to
 * correct them by hand afterwards, and a script's match must not look like a
 * decision somebody made. The same discipline as `orgPostIsInferred` (D131).
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { deskRank, rankKey } from "@/lib/desk-title";

const write = process.argv.includes("--yes");

function say(s = "") {
  console.log(s);
}

const isBengali = (s: string) => /[ঀ-৿]/.test(s);

async function main() {
  const [posts, employees] = await Promise.all([
    prisma.orgPost.findMany({
      select: { id: true, nameEn: true, nameBn: true, isActive: true },
      orderBy: { id: "asc" },
    }),
    prisma.employee.findMany({
      select: { id: true, designationEn: true, designationBn: true },
      orderBy: { id: "asc" },
    }),
  ]);

  /**
   * key → the title it becomes.
   *
   * **Posts are entered first and win the display spelling**, because they are
   * the baseline: where the roster writes *Office assistant* and the chart
   * *Office Assistant*, the chart's casing is the one that survives.
   */
  const catalogue = new Map<string, { titleEn: string; titleBn: string | null }>();

  const offer = (raw: string | null | undefined, bn?: string | null) => {
    const t = (raw ?? "").trim();
    if (!t) return null;
    const key = rankKey(t);
    if (!catalogue.has(key)) {
      catalogue.set(key, { titleEn: t, titleBn: bn?.trim() || null });
    } else if (bn?.trim() && !catalogue.get(key)!.titleBn) {
      catalogue.get(key)!.titleBn = bn.trim();
    }
    return key;
  };

  for (const p of posts) offer(p.nameEn, p.nameBn);

  // A Bengali designation is offered under its *English* rank where the rank
  // table knows one — that is how পরীক্ষক joins Examiner rather than becoming
  // its own row. Where it does not, the Bengali stands as its own title and
  // shows up on the screen for somebody to rename.
  for (const e of employees) {
    const raw = (e.designationEn ?? e.designationBn ?? "").trim();
    if (!raw) continue;
    const rank = deskRank(raw);
    if (isBengali(raw) && rank.order < 800) offer(rank.label, raw);
    else offer(raw, isBengali(raw) ? raw : null);
  }

  const rows = [...catalogue.entries()]
    .map(([titleKey, v]) => {
      const r = deskRank(v.titleEn);
      return { titleKey, titleEn: v.titleEn, titleBn: v.titleBn, rankLabel: r.label, rankOrder: r.order };
    })
    .sort((a, b) => a.rankOrder - b.rankOrder || a.titleEn.localeCompare(b.titleEn));

  say(`catalogue: ${rows.length} titles from ${posts.length} posts and ${employees.length} employees`);

  // Which desk and which designation each row would take.
  const keyOf = (s: string | null | undefined) => (s?.trim() ? rankKey(s.trim()) : null);
  const postPlan = posts.map((p) => ({ id: p.id, key: keyOf(p.nameEn) }));

  const empPlan = employees.map((e) => {
    const raw = (e.designationEn ?? e.designationBn ?? "").trim();
    const rank = deskRank(raw);
    const key = !raw ? null : isBengali(raw) && rank.order < 800 ? rankKey(rank.label) : rankKey(raw);
    return { id: e.id, key };
  });

  const unmatchedPosts = postPlan.filter((p) => !p.key).length;
  const unmatchedEmps = empPlan.filter((e) => !e.key).length;
  say(`  posts to link:      ${postPlan.length - unmatchedPosts}  (${unmatchedPosts} have no name)`);
  say(`  employees to link:  ${empPlan.length - unmatchedEmps}  (${unmatchedEmps} have no designation)`);
  say();
  say("by rank:");
  const byRank = new Map<string, number>();
  for (const r of rows) byRank.set(r.rankLabel, (byRank.get(r.rankLabel) ?? 0) + 1);
  for (const [label, n] of [...byRank.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    say(`  ${String(n).padStart(3)}  ${label}`);
  }

  if (!write) {
    say();
    say("Dry run. Add --yes to write.");
    return;
  }

  // **Upsert on `titleKey`, so re-running adds new titles without disturbing
  // ids** — a designation already corrected by hand points at an id, and a
  // catalogue rebuilt from scratch would silently repoint it at another job.
  for (const r of rows) {
    await prisma.jobTitle.upsert({
      where: { titleKey: r.titleKey },
      create: r,
      update: { rankLabel: r.rankLabel, rankOrder: r.rankOrder },
    });
  }
  const ids = new Map(
    (await prisma.jobTitle.findMany({ select: { id: true, titleKey: true } })).map((t) => [
      t.titleKey,
      t.id,
    ]),
  );

  // Grouped by target id: one `updateMany` per title rather than one per row,
  // which is what makes this ~180 round trips instead of 1,300 (D150).
  const postsByTitle = new Map<number, number[]>();
  for (const p of postPlan) {
    const id = p.key ? ids.get(p.key) : undefined;
    if (!id) continue;
    if (!postsByTitle.has(id)) postsByTitle.set(id, []);
    postsByTitle.get(id)!.push(p.id);
  }
  for (const [titleId, postIds] of postsByTitle) {
    await prisma.orgPost.updateMany({ where: { id: { in: postIds } }, data: { titleId } });
  }

  const empsByTitle = new Map<number, string[]>();
  for (const e of empPlan) {
    const id = e.key ? ids.get(e.key) : undefined;
    if (!id) continue;
    if (!empsByTitle.has(id)) empsByTitle.set(id, []);
    empsByTitle.get(id)!.push(e.id);
  }
  for (const [titleId, empIds] of empsByTitle) {
    await prisma.employee.updateMany({
      where: { id: { in: empIds } },
      // `designationIsInferred` is left true on purpose: this matched it, a
      // person did not.
      data: { designationTitleId: titleId },
    });
  }

  say();
  say(
    `DONE — ${rows.length} titles · ${[...postsByTitle.values()].flat().length} posts linked · ` +
      `${[...empsByTitle.values()].flat().length} designations linked (all marked inferred).`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
