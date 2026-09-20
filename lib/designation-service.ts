/**
 * The employee designation catalogue — reading it, tidying it, and changing it.
 *
 * **A designation is not a label.** `deskRank()` reads it to decide where
 * somebody sits in a picker; `displayDesignation()` falls back to it wherever a
 * desk is a guess; the laboratory ladder turns it into a rung, which decides
 * who may enter a result and who signs a report (D143). Editing one moves
 * files. That is why this is a service with rules rather than a text field on a
 * form.
 *
 * **It is free text out of the HR export, and it shows.** 729 active employees
 * carry **84 distinct designations**, of which a large minority are the same
 * job written twice:
 *
 * - **the same rank in two languages** — *Examiner* ×92 and *পরীক্ষক* ×15,
 *   *Assistant Director* ×87 and *সহকারী পরিচালক* ×18, six more pairs;
 * - **the same words in two casings** — *Lab Attendant* / *Lab attendant*,
 *   *Mechanical Assistant* / *Mechanical assistant*;
 * - **plain typos** — *Stenoghrapher* ×3 beside *Stenographer* ×4,
 *   *Satistician* ×1.
 *
 * Each variant is its own rank on every picker in the system, so an office's
 * Examiners appear as two groups and a search for one finds neither reliably.
 *
 * **The organogram is not touched here.** The client's line, 2026-09-20:
 * *"Organogram is the desk. I can create/delete/edit organogram desk in the
 * manage structure menu."* Posts are maintained at `/hr/organogram/manage`;
 * this is the employee's own recorded title and which post they sit on.
 */
import { prisma } from "@/lib/prisma";
import { deskRank } from "@/lib/desk-title";

/**
 * The grouping key for "these two rows are the same job".
 *
 * **Two signals, because the mess has two causes.** Where `deskRank()`
 * recognises the title — it carries the bilingual patterns already, so
 * *পরীক্ষক* and *Examiner* both answer `Examiner` — the rank label is the key
 * and the pair is found for free. Where it does not (a Turner, a Khalasi, a Gas
 * Man: real desks the chain has no rank for), it returns the title back
 * prettified, so the key falls to the squashed text and catches casing and
 * spacing variants instead.
 *
 * `order >= 800` is `deskRank()`'s own signal that it did not recognise the
 * title — 800 for an unknown desk, 900 for an empty one.
 *
 * **The parenthetical splits the group, and it has to.** `deskRank()` ignores
 * it on purpose — *Assistant Director (CM)* and *Assistant Director
 * (Metrology)* are one rank on a picker — but a *merge* keyed on the rank alone
 * would sweep *Deputy Director (CM)* and *Deputy Director (Chemistry)* into
 * plain *Deputy Director* and destroy the one thing that says which wing the
 * officer belongs to. A rank is what somebody is; a parenthetical is where.
 * So two titles merge only when they specialise the same way, or not at all.
 */
export function designationKey(designation: string): string {
  const paren = designation.match(/\(([^)]*)\)/)?.[1]?.toLowerCase().replace(/[\s._\-/]+/g, "");
  const rank = deskRank(designation);
  const base =
    rank.order < 800
      ? `rank:${rank.label}`
      : `text:${designation.replace(/\([^)]*\)/g, "").toLowerCase().replace(/[\s._\-/]+/g, "")}`;
  return paren ? `${base}|${paren}` : base;
}

/** Levenshtein, capped — only used to *suggest* a typo, never to act on one. */
function editDistance(a: string, b: string, cap = 3): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      row.push(v);
      if (v < best) best = v;
    }
    if (best > cap) return cap + 1;
    prev = row;
  }
  return prev[b.length];
}

export type DesignationRow = {
  /** The designation exactly as recorded — this is what a rename matches on. */
  value: string;
  /** English or Bengali, as stored. */
  language: "en" | "bn";
  count: number;
  key: string;
  rankLabel: string;
  grades: string[];
  offices: string[];
  /**
   * Does the organogram hold a post of this rank anywhere?
   *
   * **The column that explains an unseatable person.** 285 employees are
   * designated something the chart has no post of — 97 Examiners against zero
   * posts titled Examiner — so no correct seat exists for them and
   * `import:desks` fell back to matching on grade alone, which is where the 322
   * guessed seats came from.
   */
  hasPost: boolean;
};

export type DesignationGroup = {
  key: string;
  rankLabel: string;
  /** The variant with the most holders — the sensible merge target. */
  primary: string;
  total: number;
  variants: DesignationRow[];
  hasPost: boolean;
};

export type TypoHint = { a: string; b: string; distance: number; counts: [number, number] };

export type DesignationCatalogue = {
  totalEmployees: number;
  distinct: number;
  /** Groups with more than one variant — the merge worklist, largest first. */
  duplicates: DesignationGroup[];
  /** Every group, including the single-variant ones. */
  groups: DesignationGroup[];
  /** Near-identical titles across *different* groups: likely typos. */
  typos: TypoHint[];
  /** Ranks with holders but no post anywhere in the organogram. */
  withoutPost: DesignationGroup[];
};

const isBengali = (s: string) => /[ঀ-৿]/.test(s);

export async function designationCatalogue(): Promise<DesignationCatalogue> {
  const [employees, posts] = await Promise.all([
    prisma.employee.findMany({
      where: { status: "active" },
      select: {
        designationEn: true,
        designationBn: true,
        grade: true,
        office: { select: { nameEn: true } },
      },
    }),
    prisma.orgPost.findMany({ where: { isActive: true }, select: { nameEn: true } }),
  ]);

  const postRanks = new Set(posts.map((p) => deskRank(p.nameEn).label));

  // One row per distinct *stored string*, because that is what a rename edits.
  const byValue = new Map<string, { count: number; grades: Set<string>; offices: Set<string> }>();
  for (const e of employees) {
    const value = (e.designationEn ?? e.designationBn ?? "").trim();
    if (!value) continue;
    if (!byValue.has(value)) {
      byValue.set(value, { count: 0, grades: new Set(), offices: new Set() });
    }
    const r = byValue.get(value)!;
    r.count++;
    if (e.grade) r.grades.add(String(e.grade));
    if (e.office?.nameEn) r.offices.add(e.office.nameEn);
  }

  const rows: DesignationRow[] = [...byValue.entries()].map(([value, r]) => ({
    value,
    language: isBengali(value) ? "bn" : "en",
    count: r.count,
    key: designationKey(value),
    rankLabel: deskRank(value).label,
    grades: [...r.grades].sort((a, b) => Number(a) - Number(b)),
    offices: [...r.offices].sort(),
    hasPost: postRanks.has(deskRank(value).label),
  }));

  const byKey = new Map<string, DesignationRow[]>();
  for (const row of rows) {
    if (!byKey.has(row.key)) byKey.set(row.key, []);
    byKey.get(row.key)!.push(row);
  }

  const groups: DesignationGroup[] = [...byKey.entries()]
    .map(([key, variants]) => {
      const sorted = [...variants].sort((a, b) => b.count - a.count);
      return {
        key,
        rankLabel: sorted[0].rankLabel,
        // **The English variant wins a tie**, not merely the largest: the
        // organogram's posts are titled in English, so merging towards English
        // is what lets a designation and a post ever agree.
        primary:
          sorted.find((v) => v.language === "en" && v.count === sorted[0].count)?.value ??
          sorted[0].value,
        total: sorted.reduce((n, v) => n + v.count, 0),
        variants: sorted,
        hasPost: sorted[0].hasPost,
      };
    })
    .sort((a, b) => b.total - a.total);

  // Typos: near-identical titles that landed in *different* groups.
  //
  // **The threshold scales with length**, because it has to. At distance 2 over
  // seven characters the pair *Auditor* / *Editor* qualifies — two real and
  // unrelated desks — so a flat cap of two produced a suggestion that, acted
  // on, would have merged an auditor into an editor. One edit for a short
  // title, two only once there is enough word for two slips to be plausible.
  const typos: TypoHint[] = [];
  const en = rows.filter((r) => r.language === "en" && r.value.length >= 6);
  for (let i = 0; i < en.length; i++) {
    for (let j = i + 1; j < en.length; j++) {
      if (en[i].key === en[j].key) continue;
      const cap = Math.min(en[i].value.length, en[j].value.length) >= 10 ? 2 : 1;
      const d = editDistance(en[i].value.toLowerCase(), en[j].value.toLowerCase());
      if (d > 0 && d <= cap) {
        typos.push({
          a: en[i].value,
          b: en[j].value,
          distance: d,
          counts: [en[i].count, en[j].count],
        });
      }
    }
  }
  typos.sort((a, b) => a.distance - b.distance || b.counts[0] + b.counts[1] - (a.counts[0] + a.counts[1]));

  return {
    totalEmployees: employees.length,
    distinct: rows.length,
    duplicates: groups.filter((g) => g.variants.length > 1),
    groups,
    typos,
    withoutPost: groups.filter((g) => !g.hasPost).sort((a, b) => b.total - a.total),
  };
}

/** Who currently holds one exact designation string. */
export async function holdersOf(designation: string) {
  return prisma.employee.findMany({
    where: {
      status: "active",
      OR: [{ designationEn: designation }, { designationBn: designation }],
    },
    select: {
      id: true,
      nameEn: true,
      designationEn: true,
      designationBn: true,
      grade: true,
      office: { select: { nameEn: true } },
      orgPost: { select: { nameEn: true } },
    },
    orderBy: { id: "asc" },
  });
}

export type RenameArgs = {
  /** The exact stored string to replace. */
  from: string;
  /** What it becomes. English, because posts are titled in English. */
  toEn: string;
  /** Optional Bengali, written alongside rather than instead. */
  toBn?: string | null;
  /** Restrict to these employees; omitted means every holder. */
  employeeIds?: string[];
};

export type RenameResult = {
  from: string;
  toEn: string;
  changed: number;
  /** What the rank was and what it becomes — the part that moves files. */
  rankBefore: string;
  rankAfter: string;
  rankChanged: boolean;
  employees: { id: string; nameEn: string }[];
};

/**
 * Rename a designation across its holders.
 *
 * **`designationEn` is the column that decides everything**, and a Bengali
 * variant is stored in `designationBn`, so a merge of *পরীক্ষক* into *Examiner*
 * writes the English into `designationEn` and keeps the Bengali where it
 * belongs rather than discarding it. Nothing in the roster is lost by a merge;
 * the two columns are what the bilingual convention is for.
 *
 * **The rank change is returned, not hidden.** Renaming *Deputy Director* to
 * *Director* re-ranks that person everywhere — in the pass-down picker, in the
 * lab ladder, in who may sign a test report. The caller shows it before
 * writing; this returns it after, so a script has the same warning a screen
 * does.
 *
 * **No history is kept**, and that is a known gap rather than a decision: there
 * is no audit table for employee facts, and `import:hr-corrections` changes the
 * roster the same way. A rename is therefore reviewed before it runs and
 * reports exactly whom it touched.
 */
export async function renameDesignation(args: RenameArgs): Promise<RenameResult> {
  const from = args.from.trim();
  const toEn = args.toEn.trim();
  if (!from) throw new Error("Which designation is being renamed?");
  if (!toEn) throw new Error("A designation cannot be blank.");

  const targets = await prisma.employee.findMany({
    where: {
      status: "active",
      OR: [{ designationEn: from }, { designationBn: from }],
      ...(args.employeeIds?.length ? { id: { in: args.employeeIds } } : {}),
    },
    select: { id: true, nameEn: true, designationEn: true, designationBn: true },
  });
  if (!targets.length) throw new Error(`Nobody active is recorded as "${from}".`);

  const toBn = args.toBn?.trim() || null;
  const bengaliSource = isBengali(from) ? from : null;

  await prisma.$transaction(
    targets.map((t) =>
      prisma.employee.update({
        where: { id: t.id },
        data: {
          designationEn: toEn,
          // Keep a Bengali title rather than dropping it: an explicit one if
          // given, else the Bengali string being merged away, else whatever
          // was already there.
          designationBn: toBn ?? bengaliSource ?? t.designationBn,
        },
      }),
    ),
  );

  const rankBefore = deskRank(from).label;
  const rankAfter = deskRank(toEn).label;
  return {
    from,
    toEn,
    changed: targets.length,
    rankBefore,
    rankAfter,
    rankChanged: rankBefore !== rankAfter,
    employees: targets.map((t) => ({ id: t.id, nameEn: t.nameEn })),
  };
}

/** Change one person's recorded designation. */
export async function setDesignation(args: {
  employeeId: string;
  designationEn?: string | null;
  designationBn?: string | null;
}) {
  const e = await prisma.employee.findUnique({
    where: { id: args.employeeId },
    select: { id: true, nameEn: true, designationEn: true, designationBn: true },
  });
  if (!e) throw new Error("No such employee.");

  const nextEn =
    args.designationEn === undefined ? e.designationEn : args.designationEn?.trim() || null;
  const nextBn =
    args.designationBn === undefined ? e.designationBn : args.designationBn?.trim() || null;
  if (!nextEn && !nextBn) throw new Error("An employee must keep a designation in one language.");

  await prisma.employee.update({
    where: { id: e.id },
    data: { designationEn: nextEn, designationBn: nextBn },
  });

  const before = deskRank(e.designationEn ?? e.designationBn).label;
  const after = deskRank(nextEn ?? nextBn).label;
  return {
    employeeId: e.id,
    name: e.nameEn,
    designationEn: nextEn,
    designationBn: nextBn,
    rankBefore: before,
    rankAfter: after,
    rankChanged: before !== after,
  };
}
