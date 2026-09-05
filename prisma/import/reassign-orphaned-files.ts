/**
 * Move files held by someone who is no longer serving to their office's head.
 *
 *   npm run fix:orphaned-files -- --dry    report only, no writes
 *   npm run fix:orphaned-files             reassign
 *
 * **Why a file gets stuck.** `Application.holderEmployeeId` is a person, and
 * "nobody holds it" is the definition of unclaimed — there is no parallel state
 * to disagree with (D58). That is the right shape, and it has one consequence:
 * when the holder stops being available the file does not fall back to anybody.
 * It sits at a desk nobody is at.
 *
 * Retirement makes it worse than a stalemate. `pass()` lets only the holder move
 * a file, superadmin aside, so the officer who has left is the only person who
 * could hand it on — and they cannot, because releasing their desk left them
 * with no `sectionUnitId`, and `canPassTo()` refuses on a null section before it
 * ever looks at grade. `Desk.isActive` (D75) deliberately exempts the sender for
 * exactly this reason, but the section check comes first and the file is stuck
 * regardless.
 *
 * **Where it goes.** The office head — the desk a submitted application arrives
 * at in the first place (D57), so it is where the file would have been had the
 * holder never received it. Not the seniormost officer: the head is a role
 * precisely so that an acting officer can hold it.
 *
 * **The movement is a `reassign`.** Not an `up`: nobody sent it, and a log that
 * says "sent up by <retired officer>" is a lie in the one feature spec §8 calls
 * most of the perceived value of the system. `fromEmployeeId` still names who
 * was holding it, so the break in custody stays visible.
 *
 * Idempotent — a file whose holder is active is left alone, so a re-run after
 * everyone is in order does nothing.
 */
import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const DRY = process.argv.includes("--dry");

async function main() {
  // The administrator on whose authority the move is made. `actorUserId` is
  // required and must be a real account: "a script did it" is not an answer to
  // "who moved my file".
  const admin = await prisma.user.findFirst({
    where: { role: "superadmin" },
    select: { id: true, name: true },
  });
  if (!admin) throw new Error("No superadmin account to attribute the reassignment to.");

  const stuck = await prisma.application.findMany({
    where: { holder: { status: { not: "active" } } },
    select: {
      id: true, applicationNo: true, state: true, bstiOfficeId: true, holderEmployeeId: true,
      holder: { select: { nameEn: true, status: true } },
      bstiOffice: { select: { nameEn: true } },
      organization: { select: { nameEn: true } },
    },
    orderBy: { id: "asc" },
  });

  console.log(`Files held by someone no longer serving: ${stuck.length}`);
  if (stuck.length === 0) return;

  // Office → its head, by employee id. Read once rather than per file.
  const heads = await prisma.user.findMany({
    where: { role: "office_head" },
    select: { username: true },
  });
  const headEmployees = await prisma.employee.findMany({
    where: { id: { in: heads.map((h) => h.username).filter((x): x is string => !!x) } },
    select: {
      id: true, nameEn: true, officeId: true, status: true,
      postings: { where: { relievedAt: null }, select: { officeId: true }, take: 1 },
    },
  });
  const headOfOffice = new Map<number, { id: string; nameEn: string }>();
  for (const h of headEmployees) {
    if (h.status !== "active") continue;
    const officeId = h.postings[0]?.officeId ?? h.officeId;
    if (officeId && !headOfOffice.has(officeId)) headOfOffice.set(officeId, { id: h.id, nameEn: h.nameEn });
  }

  const moves: { id: number; no: string | null; to: string; toName: string; from: string; note: string }[] = [];
  const blocked: string[] = [];

  for (const a of stuck) {
    const label = `${a.applicationNo ?? `#${a.id}`} — ${a.organization?.nameEn ?? "?"} at ${a.bstiOffice?.nameEn ?? "?"}`;
    if (!a.bstiOfficeId) {
      blocked.push(`${label}: the file names no office, so there is no head to give it to`);
      continue;
    }
    const head = headOfOffice.get(a.bstiOfficeId);
    if (!head) {
      blocked.push(`${label}: that office has no serving office_head`);
      continue;
    }
    if (head.id === a.holderEmployeeId) {
      blocked.push(`${label}: the head is the holder — nominate someone else first`);
      continue;
    }
    moves.push({
      id: a.id,
      no: a.applicationNo,
      to: head.id,
      toName: head.nameEn,
      from: a.holderEmployeeId!,
      note: `Reassigned by administration: ${a.holder?.nameEn ?? a.holderEmployeeId} is ${a.holder?.status}.`,
    });
  }

  for (const m of moves) {
    console.log(`  ${m.no ?? m.id}: ${m.from} → ${m.to} ${m.toName}`);
    console.log(`      ${m.note}`);
  }
  for (const b of blocked) console.log(`  BLOCKED ${b}`);

  if (DRY) {
    console.log("\n--dry: nothing written.");
    return;
  }

  for (const m of moves) {
    await prisma.$transaction([
      prisma.application.update({ where: { id: m.id }, data: { holderEmployeeId: m.to } }),
      prisma.applicationMovement.create({
        data: {
          applicationId: m.id,
          fromEmployeeId: m.from,
          toEmployeeId: m.to,
          direction: "reassign",
          note: m.note,
          actorUserId: admin.id,
        },
      }),
    ]);
  }
  console.log(`\nReassigned ${moves.length}, blocked ${blocked.length}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
