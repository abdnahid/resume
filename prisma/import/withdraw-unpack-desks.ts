/**
 * Withdraw the desks the unpack created, and re-seat whoever it can (D156a).
 *
 * `npm run fix:withdraw-unpack-desks` reports; add `--yes` to write.
 *
 * **Why they should never have existed.** `fix:unpack-seats` exiled everybody
 * who had no seat onto a fresh desk outside the organogram. That produced 73
 * posts the government never sanctioned, sitting in Manage Structure beside the
 * real ones — the client saw *seven* Coordination Officer desks where the
 * establishment has one. His correction, 2026-09-21: *"unpack based on only the
 * organogram assigned post. I will create temporary post later to seat an
 * employee if needed."*
 *
 * **The organogram is the organogram.** Its 854 seats come from
 * `sanctionedCount` and are correct; what was wrong was inventing extra desks
 * from *who happened to be seated*. Most of those holders were placed by
 * `import:desks` guessing in the first place (D149), so building structure on
 * top of them compounded a guess into a post.
 *
 * **What happens to the 73.** Each is offered a **vacant sanctioned seat
 * matching their designation** in their own office — the `fix:seat-by-designation`
 * rule, which is the only placement this system trusts. Whoever has no such
 * seat is left **unseated and named**, because a person with no desk is a fact
 * to be looked at, not one to be papered over with a post.
 *
 * Desks created by hand through `/hr/listing/desks` are untouched: this only
 * withdraws what carries the unpack's own `createdReason`.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { rankKey } from "@/lib/desk-title";

const write = process.argv.includes("--yes");

function say(s = "") {
  console.log(s);
}

const MARKER = "unpacked";

async function main() {
  const doomed = await prisma.orgPost.findMany({
    where: { isSanctioned: false, createdReason: { contains: MARKER } },
    select: {
      id: true,
      nameEn: true,
      unitId: true,
      unit: { select: { nameEn: true } },
      holders: {
        where: { releasedAt: null },
        select: {
          id: true,
          employeeId: true,
          employee: {
            select: {
              nameEn: true,
              officeId: true,
              designation: { select: { titleEn: true } },
              designationEn: true,
            },
          },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  say(`${doomed.length} desks were created by the unpack and are being withdrawn`);

  const { officeRoots } = await import("@/lib/desk-service");
  const { unitBelongsToOffice } = await officeRoots();

  // Vacant sanctioned seats, claimed as we go so two people are never offered
  // the same one.
  const seats = await prisma.orgPost.findMany({
    where: { isActive: true, isSanctioned: true, holders: { none: { releasedAt: null } } },
    select: { id: true, nameEn: true, unitId: true, unit: { select: { nameEn: true } } },
    orderBy: { id: "asc" },
  });
  const claimed = new Set<number>();

  type Move = { employeeId: string; name: string; designation: string; toPostId: number; toTitle: string; toUnit: string };
  const reseated: Move[] = [];
  const unseated: { name: string; designation: string; was: string }[] = [];

  for (const d of doomed) {
    for (const h of d.holders) {
      const e = h.employee;
      const title = e.designation?.titleEn ?? e.designationEn ?? null;
      const seat = title
        ? seats.find(
            (s) =>
              !claimed.has(s.id) &&
              rankKey(s.nameEn) === rankKey(title) &&
              unitBelongsToOffice(s.unitId, e.officeId),
          )
        : undefined;

      if (seat) {
        claimed.add(seat.id);
        reseated.push({
          employeeId: h.employeeId,
          name: e.nameEn,
          designation: title!,
          toPostId: seat.id,
          toTitle: seat.nameEn,
          toUnit: seat.unit.nameEn,
        });
      } else {
        unseated.push({
          name: e.nameEn,
          designation: title ?? "—",
          was: `${d.nameEn} · ${d.unit.nameEn}`,
        });
      }
    }
  }

  say(`  ${reseated.length} can take a vacant sanctioned seat matching their designation`);
  say(`  ${unseated.length} have no such seat and will be left unseated`);

  if (reseated.length) {
    say();
    say("re-seated on the organogram:");
    for (const m of reseated) {
      say(`  ${m.name.padEnd(30)} ${m.designation.padEnd(34)} -> ${m.toTitle} · ${m.toUnit}`);
    }
  }
  if (unseated.length) {
    say();
    say("left unseated — no vacant seat of their designation in their office:");
    for (const u of unseated) {
      say(`  ${u.name.padEnd(30)} ${u.designation.padEnd(34)} (was parked on ${u.was})`);
    }
  }

  if (!write) {
    say();
    say("Dry run. Add --yes to write.");
    return;
  }

  // 1. Re-seat, before the desks they are standing on disappear.
  for (const m of reseated) {
    await prisma.employeeDesk.create({
      data: { employeeId: m.employeeId, orgPostId: m.toPostId, kind: "substantive" },
    });
    await prisma.employee.update({
      where: { id: m.employeeId },
      data: { orgPostId: m.toPostId },
    });
  }

  // 2. Anyone not re-seated loses their post entirely — said plainly rather
  //    than left pointing at a desk that is about to be deleted.
  const stillOnDoomed = doomed.flatMap((d) => d.holders.map((h) => h.employeeId));
  const reseatedIds = new Set(reseated.map((m) => m.employeeId));
  await prisma.employee.updateMany({
    where: { id: { in: stillOnDoomed.filter((id) => !reseatedIds.has(id)) } },
    data: { orgPostId: null },
  });

  // 3. The desks go, and their tenures with them. **Deleted, not closed** —
  //    these posts were created in error, and a tenure at a desk that should
  //    never have existed is not history worth keeping.
  const ids = doomed.map((d) => d.id);
  await prisma.employeeDesk.deleteMany({ where: { orgPostId: { in: ids } } });
  await prisma.orgPost.deleteMany({ where: { id: { in: ids } } });

  // 4. The closure the unpack wrote on their previous tenure said they had
  //    moved to a desk outside the organogram. They did not, any more.
  await prisma.employeeDesk.updateMany({
    where: { releaseReason: { contains: "moved to a desk outside the organogram" } },
    data: { releaseReason: "Establishment unpacked; no sanctioned seat was free." },
  });

  say();
  say(
    `DONE — ${ids.length} desks withdrawn · ${reseated.length} re-seated on the organogram · ` +
      `${unseated.length} left unseated.`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
