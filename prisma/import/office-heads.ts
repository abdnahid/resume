/**
 * Assigns the `office_head` role — the desk a submitted application arrives at.
 *
 *   npm run import:office-heads -- --dry     report only, no writes
 *   npm run import:office-heads              assign
 *
 * **Who it is.** Where someone is actually designated *Head of Office* that is
 * the answer, whatever their grade — three people are, and all three have no
 * grade at all, so ranking by seniority alone would skip exactly the right
 * person. Otherwise it is the seniormost officer: at a branch office the head
 * of office, whatever wing he comes from: a DD (Metrology) at Barisal receives CM applications and passes them
 * into the CM section. At head office it is the **CM wing director** — and
 * where that post is vacant, the seniormost officer of the CM wing acting in
 * it, which is exactly why D57 made this a role and not a designation.
 *
 * **Payroll is not collateral damage.** `User.role` is a single enum, so
 * granting `office_head` to someone who is `officeadmin` would silently take
 * away their payroll authority — and at 14 of 23 offices the natural head is
 * the current officeadmin. The two are genuinely different jobs (payroll can be
 * run by the accounts head, by any officer), so this moves `officeadmin` to the
 * office's accounts desk where one exists rather than dropping it. Where no
 * accounts desk exists the office is **reported, not guessed at**: payroll
 * still runs, because a superadmin is not office-scoped, but no one local can
 * run it until someone is nominated.
 *
 * Idempotent: skips an office that already has a head.
 */
import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const DRY = process.argv.includes("--dry");

const HEAD_OFFICE_ID = 6;
const seniority = (g: string | null) => Number(g ?? 99);

async function main() {
  const offices = await prisma.office.findMany({
    select: { id: true, nameEn: true, type: true },
    orderBy: { id: "asc" },
  });

  // The head-office CM wing, so its director can be found rather than the
  // seniormost officer in the whole building (a Textile director).
  const cmWing = await prisma.orgUnit.findFirst({
    where: { nameEn: { contains: "Certification Marks" }, parentId: null },
    select: { id: true, children: { select: { id: true } } },
  });
  const cmUnitIds = cmWing ? [cmWing.id, ...cmWing.children.map((c) => c.id)] : [];

  type Row = { office: string; head: string; note: string };
  const assigned: Row[] = [];
  const already: Row[] = [];
  const payrollMoved: Row[] = [];
  const payrollOrphaned: string[] = [];
  const noCandidate: string[] = [];
  const deskless: string[] = [];

  for (const o of offices) {
    const city = o.nameEn.split(",").pop()!.trim();

    const existing = await prisma.user.findFirst({
      where: { role: "office_head", employee: { officeId: o.id } },
      select: { employee: { select: { nameEn: true } } },
    });
    if (existing) {
      already.push({ office: city, head: existing.employee?.nameEn ?? "?", note: "already held" });
      continue;
    }

    // A designated Head of Office wins outright — grade and desk not required,
    // because two of the three have neither and are still the right person.
    const designated = await prisma.employee.findFirst({
      where: {
        officeId: o.id, status: "active",
        OR: [
          { designationEn: { contains: "Head of Office" } },
          { designationBn: { contains: "অফিস প্রধান" } },
        ],
        user: { role: { not: "superadmin" } },
      },
      select: {
        id: true, nameEn: true, grade: true, orgPostId: true,
        designationEn: true, designationBn: true,
        user: { select: { id: true, role: true } },
      },
    });

    const pool = await prisma.employee.findMany({
      where: {
        officeId: o.id, status: "active", category: "officer",
        grade: { not: null }, orgPostId: { not: null },
        ...(o.id === HEAD_OFFICE_ID && cmUnitIds.length
          ? { orgPost: { unitId: { in: cmUnitIds } } }
          : {}),
      },
      select: {
        id: true, nameEn: true, grade: true, userId: true, orgPostId: true,
        designationEn: true, designationBn: true,
        user: { select: { id: true, role: true } },
        orgPost: { select: { nameEn: true } },
      },
    });

    // At head office, the CM desk outranks the Halal one for a CM application.
    const prefersCm = (e: (typeof pool)[number]) =>
      o.id === HEAD_OFFICE_ID && /\(CM\)/i.test(e.orgPost?.nameEn ?? "") ? 0 : 1;
    pool.sort((a, b) => prefersCm(a) - prefersCm(b) || seniority(a.grade) - seniority(b.grade));

    const head = designated ?? pool.find((e) => e.user && e.user.role !== "superadmin");
    if (!head || !head.user) { noCandidate.push(city); continue; }
    // A head with no desk can receive a file but cannot pass it on:
    // `candidates()` works from `desksOfOffice`, and someone with no post is
    // not in it. Worth saying out loud rather than discovering it on the day.
    if (!head.orgPostId) deskless.push(`${city} — ${head.nameEn}`);

    const displaced = head.user.role === "officeadmin";
    let payrollTo: string | null = null;

    if (displaced) {
      const acct = await prisma.employee.findFirst({
        where: {
          officeId: o.id, status: "active", id: { not: head.id },
          OR: [
            { orgPost: { unit: { OR: [{ nameEn: { contains: "Account" } }, { nameBn: { contains: "হিসাব" } }] } } },
            { designationEn: { contains: "ccount" } },
            { designationBn: { contains: "হিসাব" } },
            { designationEn: { contains: "ashier" } },
          ],
          user: { role: "employee" },
        },
        orderBy: { grade: "asc" },
        select: { id: true, nameEn: true, designationEn: true, designationBn: true, user: { select: { id: true } } },
      });
      if (acct?.user) {
        payrollTo = `${acct.nameEn} (${acct.designationEn || acct.designationBn || "?"})`;
        if (!DRY)
          await prisma.user.update({ where: { id: acct.user.id }, data: { role: "officeadmin" } });
        payrollMoved.push({ office: city, head: acct.nameEn, note: payrollTo });
      } else {
        payrollOrphaned.push(city);
      }
    }

    if (!DRY) await prisma.user.update({ where: { id: head.user.id }, data: { role: "office_head" } });
    assigned.push({
      office: city,
      head: `g${head.grade ?? "—"} ${(head.designationEn || head.designationBn || "?").slice(0, 24)} — ${head.nameEn}`,
      note: displaced ? (payrollTo ? `payroll → ${payrollTo}` : "PAYROLL LEFT VACANT") : "",
    });
  }

  const rule = () => console.log("─".repeat(78));
  console.log(DRY ? "DRY RUN — nothing written.\n" : "");
  rule();
  console.log(`  assigned          ${assigned.length}`);
  console.log(`  already held      ${already.length}`);
  console.log(`  no candidate      ${noCandidate.length}`);
  console.log(`  payroll moved     ${payrollMoved.length}`);
  console.log(`  payroll vacated   ${payrollOrphaned.length}`);
  rule();
  for (const a of assigned)
    console.log(`  ${a.office.padEnd(14)} ${a.head.padEnd(56)} ${a.note}`);
  if (payrollOrphaned.length) {
    rule();
    console.log("PAYROLL NOW HAS NO LOCAL ADMIN — nominate someone at /hr/listing/roles.");
    console.log("A superadmin is not office-scoped, so payroll still runs meanwhile.");
    payrollOrphaned.forEach((c) => console.log(`  • ${c}`));
  }
  if (deskless.length) {
    rule();
    console.log("HEAD HAS NO DESK — can receive a file but cannot pass it on:");
    deskless.forEach((c) => console.log(`  • ${c}`));
  }
  if (noCandidate.length) {
    rule();
    console.log(`no eligible officer with a desk: ${noCandidate.join(", ")}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
