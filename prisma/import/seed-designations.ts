/**
 * Build the designation catalogue from the organogram, and move every employee
 * and every held desk onto the new model (D153).
 *
 * `npm run seed:designations` reports; add `--yes` to write.
 *
 * **Only titles the organogram sanctions.** The client's rule, 2026-09-21:
 * *"Keep only those designations whose title matches organogram desk titles...
 * you might have Inspector and Inspector (Metrology) both as designation. As
 * per organogram only Inspector (Metrology) exist. So remove the other
 * designation and if anybody has that designation then replace it with
 * Inspector (Metrology)."*
 *
 * So the catalogue is the 130 distinct post titles and nothing else, and a
 * roster designation that is not one of them is **merged** onto the closest
 * that is:
 *
 * 1. **Exact**, on `rankKey()` — *Office assistant* → *Office Assistant*.
 * 2. **The bare rank onto its only qualified post** — *Inspector* → *Inspector
 *    (Metrology)*, because the chart has exactly one Inspector title. This is
 *    the client's own example and it only fires where the answer is unique.
 * 3. **Their own desk's title**, where it agrees in rank — a bare *Examiner*
 *    sitting on an *Examiner (Chemical)* desk is an Examiner (Chemical). This
 *    is the single biggest rule, resolving 200 of them, and it is the whole
 *    reason the two vocabularies were brought together.
 * 4. **The same rank at the same grade**, where that too is unique.
 * 5. Otherwise **left unmatched and reported**, never guessed: the ranks with
 *    several candidates are real choices (an *Assistant Director* could be CM,
 *    Metrology or Chemical) and belong to the person doing the correcting.
 *
 * **Desks move to `EmployeeDesk`** in the same run: `orgPostId` becomes the
 * primary row and `actingOrgPostId` an additional charge, which is D74's model
 * expressed in the table that can now hold more than one of them.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { deskRank, rankKey } from "@/lib/desk-title";

const write = process.argv.includes("--yes");

function say(s = "") {
  console.log(s);
}

/** Which wing a title belongs to, for the officer groups in the picker. */
const QUALIFIER_WING: [RegExp, string][] = [
  [/\bCM\b/i, "Certification Marks Wing"],
  [/Metrology/i, "Metrology Wing"],
  [/Chemical|Food & Bacteriology|Agriculture & Food/i, "Chemical Testing Wing"],
  [/Physical|Textile|Civil|Mechanical|E & E/i, "Physical Testing Wing"],
  [/Halal/i, "Management Systems Certification Wing"],
  [/Standards/i, "Standards Wing"],
  [/Administration|Admin|Accounts|Audit|Planning/i, "Admin Wing"],
];

async function main() {
  const [posts, units, employees] = await Promise.all([
    prisma.orgPost.findMany({
      where: { isActive: true },
      select: { id: true, nameEn: true, nameBn: true, grade: true, unitId: true },
    }),
    prisma.orgUnit.findMany({ select: { id: true, nameEn: true, parentId: true, category: true } }),
    prisma.employee.findMany({
      select: {
        id: true,
        nameEn: true,
        grade: true,
        designationEn: true,
        designationBn: true,
        orgPostId: true,
        actingOrgPostId: true,
      },
      orderBy: { id: "asc" },
    }),
  ]);

  const unitById = new Map(units.map((u) => [u.id, u]));
  const postById = new Map(posts.map((p) => [p.id, p]));
  const wingOfUnit = (id: number): string | null => {
    let u = unitById.get(id);
    while (u) {
      if (String(u.category) === "wing") return u.nameEn;
      if (!u.parentId) return null;
      u = unitById.get(u.parentId);
    }
    return null;
  };

  // ── The catalogue: one row per distinct post title ──────────────────────
  type Draft = {
    titleEn: string;
    titleBn: string | null;
    titleKey: string;
    rankLabel: string;
    rankOrder: number;
    isOfficer: boolean;
    wing: string | null;
    grades: Set<string>;
    wings: Map<string, number>;
  };
  const drafts = new Map<string, Draft>();
  for (const p of posts) {
    const key = rankKey(p.nameEn);
    if (!drafts.has(key)) {
      const r = deskRank(p.nameEn);
      drafts.set(key, {
        titleEn: p.nameEn,
        titleBn: p.nameBn,
        titleKey: key,
        rankLabel: r.label,
        rankOrder: r.order,
        isOfficer: false,
        wing: null,
        grades: new Set(),
        wings: new Map(),
      });
    }
    const d = drafts.get(key)!;
    if (p.grade) d.grades.add(String(p.grade));
    const w = wingOfUnit(p.unitId);
    if (w) d.wings.set(w, (d.wings.get(w) ?? 0) + 1);
  }

  for (const d of drafts.values()) {
    // Officer = any sanctioned grade in 1–9.
    d.isOfficer = [...d.grades].some((g) => Number(g) >= 1 && Number(g) <= 9);
    if (!d.isOfficer) continue;
    // **The title's own qualifier breaks a tie and fills a gap.** Three titles
    // resolve to two wings because a stray post of that name sits in Admin, and
    // four exist only in branch physical labs, which root at a city rather than
    // a wing — so the chart alone cannot answer for them.
    const byQualifier = QUALIFIER_WING.find(([re]) => re.test(d.titleEn))?.[1] ?? null;
    if (d.wings.size === 1) d.wing = [...d.wings.keys()][0];
    else if (d.wings.size > 1)
      d.wing = byQualifier && d.wings.has(byQualifier)
        ? byQualifier
        : [...d.wings.entries()].sort((a, b) => b[1] - a[1])[0][0];
    else d.wing = byQualifier;
  }

  const catalogue = [...drafts.values()].sort(
    (a, b) => a.rankOrder - b.rankOrder || a.titleEn.localeCompare(b.titleEn),
  );
  say(`catalogue: ${catalogue.length} designations from ${posts.length} organogram posts`);
  say(
    `  officers (grade 1–9): ${catalogue.filter((d) => d.isOfficer).length} · staff: ${
      catalogue.filter((d) => !d.isOfficer).length
    }`,
  );
  const byWing = new Map<string, number>();
  for (const d of catalogue.filter((x) => x.isOfficer))
    byWing.set(d.wing ?? "(no wing)", (byWing.get(d.wing ?? "(no wing)") ?? 0) + 1);
  for (const [w, n] of [...byWing.entries()].sort((a, b) => b[1] - a[1]))
    say(`     ${String(n).padStart(3)}  ${w}`);

  // ── Matching every employee's recorded designation onto it ───────────────
  const byKey = new Map(catalogue.map((d) => [d.titleKey, d]));
  const byRank = new Map<string, Draft[]>();
  for (const d of catalogue) {
    const k = rankKey(d.rankLabel);
    if (!byRank.has(k)) byRank.set(k, []);
    byRank.get(k)!.push(d);
  }

  type Match = { id: string; name: string; raw: string; key: string | null; how: string };
  const matches: Match[] = [];
  for (const e of employees) {
    const raw = (e.designationEn ?? e.designationBn ?? "").trim();
    if (!raw) {
      matches.push({ id: e.id, name: e.nameEn, raw: "(none)", key: null, how: "no designation" });
      continue;
    }
    const exact = byKey.get(rankKey(raw));
    if (exact) {
      matches.push({ id: e.id, name: e.nameEn, raw, key: exact.titleKey, how: "exact" });
      continue;
    }
    const sameRank = byRank.get(rankKey(deskRank(raw).label)) ?? [];
    if (sameRank.length === 1) {
      matches.push({ id: e.id, name: e.nameEn, raw, key: sameRank[0].titleKey, how: "sole title of that rank" });
      continue;
    }
    /**
     * **Their own desk answers it, where it agrees in rank.**
     *
     * A bare *Examiner* has 17 qualified titles to choose from and the title
     * alone cannot say which — but the person is sitting on one. An Examiner on
     * an *Examiner (Chemical)* desk is an Examiner (Chemical); that is the
     * whole reason the two vocabularies were merged. **Only where the ranks
     * agree**, so a guessed seat of the wrong rank (D149's 322) cannot drag a
     * designation along with it.
     */
    const deskTitle = e.orgPostId ? postById.get(e.orgPostId)?.nameEn : null;
    if (deskTitle) {
      const d = byKey.get(rankKey(deskTitle));
      if (d && rankKey(d.rankLabel) === rankKey(deskRank(raw).label)) {
        matches.push({ id: e.id, name: e.nameEn, raw, key: d.titleKey, how: "their own desk, same rank" });
        continue;
      }
    }
    const atGrade = e.grade ? sameRank.filter((d) => d.grades.has(String(e.grade))) : [];
    if (atGrade.length === 1) {
      matches.push({ id: e.id, name: e.nameEn, raw, key: atGrade[0].titleKey, how: "sole title of that rank at their grade" });
      continue;
    }
    matches.push({
      id: e.id,
      name: e.nameEn,
      raw,
      key: null,
      how: sameRank.length ? `${sameRank.length} candidates — a real choice` : "no title of that rank",
    });
  }

  const matched = matches.filter((m) => m.key);
  const unmatched = matches.filter((m) => !m.key);
  say();
  say(`employees: ${matched.length} matched · ${unmatched.length} left for a person to decide`);
  const byHow = new Map<string, number>();
  for (const m of matches) byHow.set(m.how, (byHow.get(m.how) ?? 0) + 1);
  for (const [how, n] of [...byHow.entries()].sort((a, b) => b[1] - a[1]))
    say(`  ${String(n).padStart(4)}  ${how}`);

  const unmatchedTitles = new Map<string, number>();
  for (const m of unmatched) unmatchedTitles.set(m.raw, (unmatchedTitles.get(m.raw) ?? 0) + 1);
  if (unmatchedTitles.size) {
    say();
    say("left unmatched, by recorded title:");
    for (const [t, n] of [...unmatchedTitles.entries()].sort((a, b) => b[1] - a[1]))
      say(`  ${String(n).padStart(4)}  ${t}`);
  }

  const withDesk = employees.filter((e) => e.orgPostId || e.actingOrgPostId);
  say();
  say(
    `desks to move into EmployeeDesk: ${withDesk.filter((e) => e.orgPostId).length} primary · ` +
      `${withDesk.filter((e) => e.actingOrgPostId).length} additional charge`,
  );

  if (!write) {
    say();
    say("Dry run. Add --yes to write.");
    return;
  }

  // ── Write ────────────────────────────────────────────────────────────────
  for (const d of catalogue) {
    await prisma.designation.upsert({
      where: { titleKey: d.titleKey },
      create: {
        titleEn: d.titleEn,
        titleBn: d.titleBn,
        titleKey: d.titleKey,
        rankLabel: d.rankLabel,
        rankOrder: d.rankOrder,
        isOfficer: d.isOfficer,
        wing: d.wing,
      },
      update: { rankLabel: d.rankLabel, rankOrder: d.rankOrder, isOfficer: d.isOfficer, wing: d.wing },
    });
  }
  const ids = new Map(
    (await prisma.designation.findMany({ select: { id: true, titleKey: true } })).map((d) => [
      d.titleKey,
      d.id,
    ]),
  );

  // Grouped by target id — one `updateMany` per designation, not per person.
  const byTarget = new Map<number, string[]>();
  for (const m of matched) {
    const id = ids.get(m.key!)!;
    if (!byTarget.has(id)) byTarget.set(id, []);
    byTarget.get(id)!.push(m.id);
  }
  for (const [designationId, empIds] of byTarget) {
    const d = catalogue.find((x) => ids.get(x.titleKey) === designationId)!;
    await prisma.employee.updateMany({
      where: { id: { in: empIds } },
      // The recorded text is brought onto the sanctioned title in the same
      // write — that is what "replace it with Inspector (Metrology)" means.
      data: { designationId, designationEn: d.titleEn, designationIsInferred: true },
    });
  }

  // Desks: the scalar columns become rows. Existing rows are cleared first so
  // a re-run is idempotent rather than additive.
  await prisma.employeeDesk.deleteMany({});
  const deskRows = withDesk.flatMap((e) => [
    ...(e.orgPostId
      ? [{ employeeId: e.id, orgPostId: e.orgPostId, kind: "substantive" as const }]
      : []),
    ...(e.actingOrgPostId && e.actingOrgPostId !== e.orgPostId
      ? [{ employeeId: e.id, orgPostId: e.actingOrgPostId, kind: "additional_charge" as const, note: "Additional charge" }]
      : []),
  ]);
  for (let i = 0; i < deskRows.length; i += 200) {
    await prisma.employeeDesk.createMany({ data: deskRows.slice(i, i + 200), skipDuplicates: true });
  }

  say();
  say(
    `DONE — ${catalogue.length} designations · ${matched.length} employees matched · ` +
      `${deskRows.length} desk rows.`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
