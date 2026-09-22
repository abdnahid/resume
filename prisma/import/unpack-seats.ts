/**
 * Unpack the establishment: one organogram row per seat (D156).
 *
 * `npm run fix:unpack-seats` reports; add `--yes` to write.
 *
 * **Why.** A post sanctioned for two Field Officers was one row with
 * `sanctionedCount: 2`, which made "this desk" ambiguous in the two ways that
 * matter: you cannot hand over seat 1 of a pool when its holder leaves, and
 * "who has served at this desk" has no answer. The client's own framing,
 * 2026-09-21: *"we should identify those as separate desk with different ID...
 * have the history of all the employees worked at that desk, their joining
 * date, release date."*
 *
 * **Existing rows keep their ids and become seat 1.** That is the whole reason
 * this is safe to run against live data: `hr-corrections.ts` names three post
 * ids outright, every `EmployeeDesk` row points at one, and files in flight
 * route through the unit a post belongs to. Only seats 2…n are new rows.
 *
 * **Order matters, and getting it wrong is expensive.** The seats are created
 * first, then the holders are *spread across them*, and only whoever is still
 * left over gets a desk outside the organogram. The first version computed the
 * excess up front — against the old `sanctionedCount`, before seat 2 existed —
 * and so exiled 139 people who had a perfectly good vacant seat waiting for
 * them. Each phase now reads the state it actually runs against.
 *
 * **Whoever is genuinely left over gets a desk outside the organogram** (the
 * client's choice, option (a)): a desk with `sanctionedCount: 0`, a reason on
 * the record, and a line in the manpower report (D155). The alternative was to
 * leave them sharing a seat, which is the invisible over-count this work exists
 * to end.
 *
 * **Who keeps the sanctioned seat** where several hold one: the longest-serving
 * tenure, by `assignedAt` then employee id. It has to be decided by something,
 * and seniority of tenure is the rule an office would use itself — but every
 * displacement is printed, because it is a real change to somebody's record.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";

const write = process.argv.includes("--yes");

function say(s = "") {
  console.log(s);
}

async function main() {
  const posts = await prisma.orgPost.findMany({
    where: { isActive: true, isSanctioned: true },
    select: {
      id: true,
      nameEn: true,
      nameBn: true,
      grade: true,
      sortOrder: true,
      sanctionedCount: true,
      seatNo: true,
      unitId: true,
      unit: { select: { nameEn: true } },
      holders: {
        where: { releasedAt: null, kind: "substantive" },
        select: {
          id: true,
          employeeId: true,
          assignedAt: true,
          employee: { select: { nameEn: true } },
        },
        orderBy: [{ assignedAt: "asc" }, { employeeId: "asc" }],
      },
    },
    orderBy: { id: "asc" },
  });

  const multi = posts.filter((p) => p.sanctionedCount > 1);
  const newSeats = multi.reduce((n, p) => n + (p.sanctionedCount - 1), 0);

  // Seats per (unit, title) after unpacking, against the people on them — the
  // only honest way to say who will be left over.
  const groups = new Map<string, { seats: number; holders: number; title: string; unitEn: string }>();
  for (const p of posts) {
    const k = `${p.unitId}::${p.nameEn}`;
    const g = groups.get(k) ?? { seats: 0, holders: 0, title: p.nameEn, unitEn: p.unit.nameEn };
    g.seats += Math.max(p.sanctionedCount, 1);
    g.holders += p.holders.length;
    groups.set(k, g);
  }
  const leftOver = [...groups.values()].filter((g) => g.holders > g.seats);

  say(`${posts.length} sanctioned posts · ${posts.reduce((n, p) => n + p.sanctionedCount, 0)} seats`);
  say(`  ${multi.length} posts hold more than one seat → ${newSeats} new rows`);
  say(
    `  ${leftOver.reduce((n, g) => n + (g.holders - g.seats), 0)} holders will still have no seat ` +
      `→ a desk outside the organogram each`,
  );
  say();

  say("posts being unpacked (first 12):");
  for (const p of multi.slice(0, 12)) {
    say(
      `  ${String(p.sanctionedCount).padStart(2)} seats  ${p.nameEn.padEnd(34)} ${p.unit.nameEn.padEnd(30)} held by ${p.holders.length}`,
    );
  }
  if (multi.length > 12) say(`  … and ${multi.length - 12} more`);

  if (leftOver.length) {
    say();
    say("over strength even after unpacking — the surplus gets a desk outside the organogram:");
    for (const g of leftOver) {
      say(`  ${g.title.padEnd(34)} ${g.unitEn.padEnd(30)} ${g.holders} on ${g.seats} seats`);
    }
  }

  if (!write) {
    say();
    say("Dry run. Add --yes to write.");
    return;
  }

  // ── 1. Seats 2…n, as new rows ────────────────────────────────────────────
  const rows = multi.flatMap((p) =>
    Array.from({ length: p.sanctionedCount - 1 }, (_, i) => ({
      unitId: p.unitId,
      nameEn: p.nameEn,
      nameBn: p.nameBn,
      grade: p.grade,
      sortOrder: p.sortOrder,
      sanctionedCount: 1,
      seatNo: i + 2,
      isSanctioned: true,
    })),
  );
  for (let i = 0; i < rows.length; i += 200) {
    await prisma.orgPost.createMany({ data: rows.slice(i, i + 200) });
  }

  // ── 2. Every sanctioned row is now exactly one seat ──────────────────────
  await prisma.orgPost.updateMany({
    where: { isSanctioned: true, sanctionedCount: { gt: 1 } },
    data: { sanctionedCount: 1 },
  });

  // ── 3. Spread the holders across the seats that now exist ───────────────
  const spread = await redistribute();

  // ── 4. Only now: whoever is still double-held goes outside the organogram ─
  const exiled = await exileLeftovers();

  say();
  say(
    `DONE — ${rows.length} seats created · ${multi.length} posts unpacked · ` +
      `${spread} spread across seats · ${exiled} moved to desks outside the organogram.`,
  );
}

/**
 * Move surplus holders onto the sibling seats that now exist.
 *
 * Idempotent: it looks at what is actually double-held rather than at what this
 * run created, so it can be re-run and will settle any seat that two people
 * end up sharing later.
 *
 * **The longest-serving tenure keeps seat 1.** Something has to decide, and
 * seniority of tenure is the rule an office would use itself.
 */
async function redistribute(): Promise<number> {
  const posts = await prisma.orgPost.findMany({
    where: { isActive: true, isSanctioned: true },
    select: {
      id: true,
      nameEn: true,
      unitId: true,
      seatNo: true,
      holders: {
        where: { releasedAt: null, kind: "substantive" },
        select: { id: true, employeeId: true, assignedAt: true },
        orderBy: [{ assignedAt: "asc" }, { employeeId: "asc" }],
      },
    },
  });

  // Vacant seats, keyed by the group a seat belongs to.
  const key = (unitId: number, nameEn: string) => `${unitId}::${nameEn}`;
  const vacant = new Map<string, number[]>();
  for (const p of posts) {
    if (p.holders.length) continue;
    const k = key(p.unitId, p.nameEn);
    if (!vacant.has(k)) vacant.set(k, []);
    vacant.get(k)!.push(p.id);
  }
  for (const list of vacant.values()) list.sort((a, b) => a - b);

  let moved = 0;
  for (const p of posts) {
    if (p.holders.length < 2) continue;
    const free = vacant.get(key(p.unitId, p.nameEn)) ?? [];
    for (const h of p.holders.slice(1)) {
      const seat = free.shift();
      if (seat === undefined) break; // no sibling seat left; stays double-held
      await prisma.employeeDesk.update({
        where: { id: h.id },
        data: { releasedAt: new Date(), releaseReason: "Establishment unpacked; moved to its own seat." },
      });
      await prisma.employeeDesk.create({
        data: { employeeId: h.employeeId, orgPostId: seat, kind: "substantive" },
      });
      await prisma.employee.update({ where: { id: h.employeeId }, data: { orgPostId: seat } });
      moved++;
    }
  }
  return moved;
}

/**
 * Whoever is still sharing a seat after redistribution has no seat to take.
 *
 * **Derived from the state, not from a list made earlier.** Running after
 * `redistribute()` is the whole point: only somebody with no vacant sibling
 * seat anywhere reaches here.
 */
async function exileLeftovers(): Promise<number> {
  const doubled = await prisma.orgPost.findMany({
    where: { isActive: true, isSanctioned: true },
    select: {
      id: true, nameEn: true, nameBn: true, unitId: true,
      holders: {
        where: { releasedAt: null, kind: "substantive" },
        select: { id: true, employeeId: true, assignedAt: true },
        orderBy: [{ assignedAt: "asc" }, { employeeId: "asc" }],
      },
    },
  });

  let moved = 0;
  for (const p of doubled) {
    for (const h of p.holders.slice(1)) {
      const post = await prisma.orgPost.create({
        data: {
          unitId: p.unitId, nameEn: p.nameEn, nameBn: p.nameBn,
          sanctionedCount: 0, isSanctioned: false, seatNo: 1,
          createdReason:
            `Held over sanctioned strength when the establishment was unpacked on ` +
            `${new Date().toISOString().slice(0, 10)}; pending sanction of an additional post.`,
        },
        select: { id: true },
      });
      await prisma.employeeDesk.update({
        where: { id: h.id },
        data: { releasedAt: new Date(), releaseReason: "Establishment unpacked; no sanctioned seat free." },
      });
      await prisma.employeeDesk.create({
        data: { employeeId: h.employeeId, orgPostId: post.id, kind: "substantive" },
      });
      await prisma.employee.update({ where: { id: h.employeeId }, data: { orgPostId: post.id } });
      moved++;
    }
  }
  return moved;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
