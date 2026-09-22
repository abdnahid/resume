/**
 * Seat people on the desk that matches the designation they hold.
 *
 * `npm run fix:seat-by-designation -- --office=8` reports; add `--yes` to write.
 * Omit `--office` for every office.
 *
 * **One rule, and it is deliberately narrow:** a person whose designation is
 * *Assistant Director (Metrology)* belongs on the *Assistant Director
 * (Metrology)* desk of their own office. Exact title, on `rankKey()`. Nothing
 * else is inferred — not "close enough", not by grade, not by discipline —
 * because every looser rule is how the 322 guessed seats came about (D149).
 *
 * **It respects the sanctioned count**, and it does so across the whole office
 * at once rather than per person: seating is a rotation, not a queue. At
 * Faridpur, moving Aleya Khatun onto the Metrology desk requires Zubayer Al
 * Siddiki to leave it first, and a per-person pass in the wrong order would
 * refuse the first move and then have nothing to do on the second. So the run
 * computes every placement, frees every seat it is about to fill, and writes.
 *
 * **A confirmed designation outranks a guessed one** when two people want the
 * same desk. That is the only tie-break, and it is the right one: the client
 * decided one of them by hand and a script guessed the other.
 *
 * **Additional charges are never touched.** This sets the primary desk; a post
 * held in addition to one's own (D74/D153) was recorded deliberately and is not
 * a script's to move.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { rankKey } from "@/lib/desk-title";
import { officeRoots } from "@/lib/desk-service";

const args = process.argv.slice(2);
const write = args.includes("--yes");
const officeArg = args.find((a) => a.startsWith("--office="))?.slice(9);

function say(s = "") {
  console.log(s);
}

type Plan = {
  employeeId: string;
  name: string;
  designation: string;
  confirmed: boolean;
  fromPostId: number | null;
  fromTitle: string | null;
  toPostId: number | null;
  toTitle: string | null;
  note: string;
};

async function planOffice(officeId: number, officeName: string): Promise<Plan[]> {
  const { unitBelongsToOffice } = await officeRoots();

  const [people, allPosts] = await Promise.all([
    prisma.employee.findMany({
      where: { officeId, status: { not: "retired" } },
      select: {
        id: true,
        nameEn: true,
        designationIsInferred: true,
        designation: { select: { titleEn: true } },
        designationEn: true,
        desks: {
          where: { releasedAt: null },
          select: { orgPostId: true, kind: true, orgPost: { select: { nameEn: true } } },
        },
      },
      orderBy: { id: "asc" },
    }),
    prisma.orgPost.findMany({
      where: { isActive: true },
      select: {
        id: true,
        nameEn: true,
        sanctionedCount: true,
        unitId: true,
        // Who is on it *now* — seats do not start empty.
        holders: {
          where: { releasedAt: null, kind: "substantive" },
          select: { employeeId: true },
        },
      },
      orderBy: { id: "asc" },
    }),
  ]);

  const posts = allPosts.filter((p) => unitBelongsToOffice(p.unitId, officeId));
  const byTitle = new Map<string, typeof posts>();
  for (const p of posts) {
    const k = rankKey(p.nameEn);
    if (!byTitle.has(k)) byTitle.set(k, []);
    byTitle.get(k)!.push(p);
  }

  // Confirmed designations are placed first, so they win a contested desk.
  const ordered = [...people].sort(
    (a, b) => Number(a.designationIsInferred) - Number(b.designationIsInferred),
  );

  /**
   * **Seeded with who is already sitting there.**
   *
   * It started empty and counted only what this run assigned, so a seat held by
   * somebody the run was not moving looked vacant and was handed to a second
   * person — 27 seats ended up double-held. Occupancy is a fact about the
   * database, not about this run.
   *
   * A person the run *is* moving is not counted against their old seat, because
   * they are about to leave it.
   */
  const movingAway = new Set(
    people
      .filter((e) => e.desks.some((d) => d.kind === "substantive"))
      .map((e) => e.id),
  );
  const used = new Map<number, number>();
  for (const p of posts) {
    const staying = p.holders.filter((h) => !movingAway.has(h.employeeId)).length;
    if (staying) used.set(p.id, staying);
  }
  const plans: Plan[] = [];

  for (const e of ordered) {
    const primary = e.desks.find((d) => d.kind === "substantive") ?? null;
    const title = e.designation?.titleEn ?? null;
    const base = {
      employeeId: e.id,
      name: e.nameEn,
      designation: title ?? e.designationEn ?? "—",
      confirmed: !e.designationIsInferred,
      fromPostId: primary?.orgPostId ?? null,
      fromTitle: primary?.orgPost.nameEn ?? null,
    };

    if (!title) {
      plans.push({ ...base, toPostId: null, toTitle: null, note: "no designation set" });
      continue;
    }

    const candidates = byTitle.get(rankKey(title)) ?? [];
    if (!candidates.length) {
      plans.push({
        ...base,
        toPostId: null,
        toTitle: null,
        note: `this office has no "${title}" desk`,
      });
      continue;
    }

    // Keep the seat they already hold if it is one of the right ones.
    const keep = candidates.find((c) => c.id === primary?.orgPostId);
    const target =
      keep ??
      candidates.find(
        (c) => (used.get(c.id) ?? 0) + c.holders.filter((h) => !movingAway.has(h.employeeId)).length * 0 < c.sanctionedCount,
      ) ??
      null;

    if (!target) {
      plans.push({
        ...base,
        toPostId: null,
        toTitle: null,
        note: `every "${title}" desk is at its sanctioned count`,
      });
      continue;
    }

    used.set(target.id, (used.get(target.id) ?? 0) + 1);
    plans.push({
      ...base,
      toPostId: target.id,
      toTitle: target.nameEn,
      note: keep ? "already correct" : primary ? "moved" : "seated",
    });
  }

  say(`\n=== ${officeName} (office ${officeId}) ===`);
  const width = Math.max(...plans.map((p) => p.name.length), 4);
  for (const p of plans.sort((a, b) => a.name.localeCompare(b.name))) {
    const mark = p.confirmed ? "SET  " : "guess";
    const move =
      p.note === "already correct"
        ? `stays on ${p.toTitle}`
        : p.toPostId
          ? `${p.fromTitle ?? "no desk"}  ->  ${p.toTitle}`
          : `${p.fromTitle ?? "no desk"}  ->  UNSEATABLE (${p.note})`;
    say(`  ${mark} ${p.name.padEnd(width)}  ${p.designation.padEnd(36)} ${move}`);
  }
  return plans;
}

async function main() {
  const offices = await prisma.office.findMany({
    where: officeArg ? { id: Number(officeArg) } : {},
    select: { id: true, nameEn: true },
    orderBy: { id: "asc" },
  });
  if (!offices.length) throw new Error("No such office.");

  const all: Plan[] = [];
  for (const o of offices) all.push(...(await planOffice(o.id, o.nameEn)));

  const changes = all.filter((p) => p.toPostId && p.note !== "already correct");
  const stuck = all.filter((p) => !p.toPostId);
  say();
  say(
    `${all.length} people · ${changes.length} to move or seat · ` +
      `${all.length - changes.length - stuck.length} already correct · ${stuck.length} unseatable`,
  );

  if (!write) {
    say();
    say("Dry run. Add --yes to write.");
    return;
  }

  /**
   * **Every seat is vacated before any is filled.** The changes are a rotation
   * — A takes B's desk while B takes C's — so writing them one at a time in
   * any order puts two people on a one-seat post partway through. Clearing
   * first means the intermediate state is empty rather than wrong.
   */
  const movingIds = changes.map((c) => c.employeeId);
  // **Closed, never deleted** (D156): the old tenure is this desk's history.
  await prisma.employeeDesk.updateMany({
    where: { employeeId: { in: movingIds }, kind: "substantive", releasedAt: null },
    data: { releasedAt: new Date(), releaseReason: "Reseated from the designation held." },
  });
  await prisma.employeeDesk.createMany({
    data: changes.map((c) => ({ employeeId: c.employeeId, orgPostId: c.toPostId!, kind: "substantive" as const })),
  });
  // The mirrors the 51 unmigrated readers still use (D153).
  for (const c of changes) {
    await prisma.employee.update({
      where: { id: c.employeeId },
      data: { orgPostId: c.toPostId, orgPostIsInferred: false },
    });
  }

  say();
  say(`DONE — ${changes.length} primary desks set from the designation held.`);
  if (stuck.length) say(`${stuck.length} could not be seated; see the list above.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
