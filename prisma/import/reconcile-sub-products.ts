/**
 * One article, one sub-product — across every wing's file.
 *
 *     npm run labs:reconcile -- --dry
 *
 * **The problem.** Each wing files its own parameter list, and the sub-product
 * name is the residue left after the product name and the standard are removed
 * from the block heading. Where a wing tests the article as a whole rather than
 * variant by variant, that residue is just the product again — so the Chemical
 * Wing's file produced *Sanitary Napkins » "Sanitary Napkin"* while the textile
 * file produced *Sanitary Napkins » "Sanitary Towels/ Napkins"*, and the
 * importer, keying on `(productId, nameEn)`, wrote two rows for one article.
 *
 * That is not a cosmetic duplicate. A sub-product is the level a test plan
 * resolves against (D67): two rows mean an applicant picks one of them and is
 * tested for half of what the standard requires, and is charged for half.
 *
 * **The rule, as the client set it (2026-09-08).** A wing that contributes
 * exactly one sub-product for a product is testing the **whole product**, not a
 * variant of it. So:
 *
 * - Where another wing named real variants, that wing's parameters apply to
 *   **every one of them** — the microbiological count on a disposable diaper is
 *   run on each size, because each size is a separate sample. The parameters
 *   are copied onto each variant and the whole-product row is removed.
 * - Where no wing named variants — every one contributed a single row — the
 *   rows are the same article under different spellings, and they merge into
 *   one.
 *
 * **Folded, not deleted.** The whole-product row stays, marked `foldedAt` and
 * emptied of parameters. Re-running that wing's importer writes its parameters
 * straight back onto it — it keys on `(productId, nameEn)`, so a deleted row is
 * simply recreated — and this script then folds them away again. Detecting the
 * re-import by comparing parameter names instead would be unsafe: the same test
 * names recur across genuinely different variants (D60), and *Suji » Small
 * particle grade* carries the same eight test names as *Large particle grade*
 * while being a different article entirely.
 *
 * **Copied, not shared.** A parameter is owned by its sub-product and never
 * shared (D60): the same test carries a different limit and a different fee
 * under different variants often enough that owning it downward is what makes a
 * mismatch unrepresentable. So each variant gets its own row, its own package
 * fee, and its own capability and routing — carried over from the source, so an
 * office that had already decided where the test goes keeps that decision.
 *
 * **It refuses rather than guesses** when two wings both name variants and
 * disagree about them: which of A's three grades each of B's eight sizes
 * corresponds to is not a thing a script can know.
 *
 * Run it after importing any wing's file. It is idempotent and reports before
 * it writes.
 */
import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const DRY = process.argv.includes("--dry");

type SubProductRow = {
  id: number;
  nameEn: string;
  /** Set once this row has been folded into the real variants (D112). */
  foldedAt: Date | null;
  parameters: { id: number; nameEn: string; sourceSection: string }[];
  _count: { applicationEntries: number; officeRequirements: number; testOrders: number };
};

/** What one product needs doing, decided before anything is written. */
type Plan =
  | { kind: "fold"; product: string; serial: number; source: SubProductRow; section: string; targets: SubProductRow[]; why: string }
  | { kind: "refuse"; product: string; serial: number; why: string };

const sectionsOf = (sp: SubProductRow) => new Set(sp.parameters.map((x) => x.sourceSection));

/**
 * Tokens, lower-cased, each de-pluralised, joined.
 *
 * "Disposable Diapers" and "Disposable Diaper" are the same article named by
 * two wings; the difference is a plural and a comma, and nothing else.
 */
const key = (s: string) =>
  s.toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w))
    .join("");

function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * Does this sub-product name the **whole product** rather than a variant of it?
 *
 * This is the signal, and it has to be the name rather than the shape of the
 * data. Counting rows per wing looked sufficient — one row against many is a
 * whole-product package against a variant set — until a wing's file is imported
 * a second time and writes its row back, at which point that wing has *nine*
 * rows against the other's eight and the counts say the two disagree about
 * variants. The name does not move.
 *
 * A little fuzz, because the wings do not spell alike: the Chemical Wing writes
 * *Non Oven wipes* for the published list's *Nonwoven Wipes*. Deliberately
 * tight — one edit per ten characters — so that *Sanitary Towels/ Napkins*
 * stays a variant name and *Disposable Baby Diaper, Size- XS* is not close to
 * anything.
 */
function namesWholeProduct(subProduct: string, product: string): boolean {
  const a = key(subProduct), b = key(product);
  if (!a || !b) return false;
  if (a === b) return true;
  return distance(a, b) <= Math.max(1, Math.floor(Math.max(a.length, b.length) * 0.1));
}

async function plan(): Promise<Plan[]> {
  const products = await prisma.product.findMany({
    where: { subProducts: { some: {} } },
    select: {
      id: true, serial: true, nameEn: true,
      subProducts: {
        select: {
          id: true, nameEn: true, foldedAt: true,
          parameters: { select: { id: true, nameEn: true, sourceSection: true } },
          _count: { select: { applicationEntries: true, officeRequirements: true, testOrders: true } },
        },
      },
    },
    orderBy: { serial: "asc" },
  });

  const plans: Plan[] = [];

  for (const p of products) {
    // A row already folded that carries parameters again is a re-import: the
    // wing's file was run a second time and wrote them straight back onto it.
    // It is known by its flag, never by comparing names against its siblings —
    // the same test names recur across genuinely different variants (D60).
    const refolds = p.subProducts.filter((sp) => sp.foldedAt && sp.parameters.length);
    const active = p.subProducts.filter((sp) => !sp.foldedAt && sp.parameters.length);

    const sections = new Set(active.flatMap((sp) => [...sectionsOf(sp)]));
    if (sections.size < 2 && !refolds.length) continue;

    const blocked = p.subProducts.find((sp) => sp._count.testOrders > 0);
    if (blocked) {
      plans.push({
        kind: "refuse", product: p.nameEn, serial: p.serial,
        why: `“${blocked.nameEn}” already has laboratory test orders against it; moving it would orphan sealed work`,
      });
      continue;
    }

    const whole = active.filter((sp) => namesWholeProduct(sp.nameEn, p.nameEn));
    const variants = active.filter((sp) => !namesWholeProduct(sp.nameEn, p.nameEn));

    let targets: SubProductRow[];
    let sources: SubProductRow[];

    if (variants.length) {
      // Two wings each naming a *different* set of variants is the one case a
      // script cannot resolve: which of A's three grades each of B's eight
      // sizes corresponds to is a question only the wings can answer.
      //
      // **Compared as row sets, not as counts.** Once a fold has happened the
      // variants carry both wings' parameters, so counting rows per wing shows
      // eight against eight and reads as a disagreement — when it is the same
      // eight rows, which is the agreement.
      const perSection = new Map<string, Set<number>>();
      for (const v of variants)
        for (const sec of sectionsOf(v)) {
          if (!perSection.has(sec)) perSection.set(sec, new Set());
          perSection.get(sec)!.add(v.id);
        }
      const naming = [...perSection].filter(([, ids]) => ids.size > 1);
      const same = (a: Set<number>, b: Set<number>) =>
        a.size === b.size && [...a].every((x) => b.has(x));
      const disagree = naming.filter(([, ids]) => !same(ids, naming[0][1]));
      if (disagree.length) {
        plans.push({
          kind: "refuse", product: p.nameEn, serial: p.serial,
          why: `two wings name different sets of variants — ${naming.map(([sec, ids]) => `${sec} (${ids.size})`).join(" vs ")} — and which corresponds to which is not something a script can know`,
        });
        continue;
      }
      targets = variants;
      sources = [...whole, ...refolds];
    } else {
      // Every row names the product: the same article spelled several ways.
      // Keep the fullest — it has the most to lose — and break a tie on id so
      // a re-run cannot pick differently.
      if (active.length < 2 && !refolds.length) continue;
      const sorted = [...active].sort(
        (a, b) => b.parameters.length - a.parameters.length || a.id - b.id,
      );
      targets = sorted.slice(0, 1);
      sources = [...sorted.slice(1), ...refolds];
    }

    if (!targets.length || !sources.length) continue;

    for (const source of sources) {
      const [section] = sectionsOf(source);
      plans.push({
        kind: "fold", product: p.nameEn, serial: p.serial, source, section, targets,
        why: source.foldedAt
          ? `written back by a re-import of the ${section} file`
          : targets.length === 1
            ? `the same article as “${targets[0].nameEn}”, spelled differently`
            : `names the whole product, so its tests apply to each of its ${targets.length} variants`,
      });
    }
  }
  return plans;
}

/**
 * Carry anything pointing at the row being folded over to the variants.
 *
 * An application naming this article was naming *the article* — which row it
 * hung off is our modelling, not the applicant's choice — so it moves rather
 * than being deleted with the parameters. Where the article is now several
 * variants there is no way to know which was meant, so it goes to the first and
 * the applicant can change it while the file is still a draft.
 */
async function repoint(fromId: number, toId: number) {
  const links = await prisma.applicationSubProduct.findMany({
    where: { subProductId: fromId },
    select: { id: true, applicationId: true },
  });
  for (const l of links) {
    const existing = await prisma.applicationSubProduct.findUnique({
      where: { applicationId_subProductId: { applicationId: l.applicationId, subProductId: toId } },
      select: { id: true },
    });
    if (existing) await prisma.applicationSubProduct.delete({ where: { id: l.id } });
    else await prisma.applicationSubProduct.update({ where: { id: l.id }, data: { subProductId: toId } });
  }
  // A remembered sample count follows the article, not the row it hung off.
  // Upserted rather than updated: the target may already have one for that
  // office, and two rows cannot share the key.
  const reqs = await prisma.officeSampleRequirement.findMany({ where: { subProductId: fromId } });
  for (const r of reqs) {
    await prisma.officeSampleRequirement.upsert({
      where: { officeId_subProductId: { officeId: r.officeId, subProductId: toId } },
      create: { ...r, subProductId: toId },
      update: {},
    });
  }
  await prisma.officeSampleRequirement.deleteMany({ where: { subProductId: fromId } });
  return links.length;
}

/**
 * Fold one whole-product row into the variants that are the real article.
 *
 * Copy rather than move, because a parameter is owned by its sub-product and
 * never shared (D60) — eight diaper sizes are eight rows carrying the same
 * microbiological count, each free to be corrected on its own. Capability and
 * routing are carried across with it, so an office that had already decided
 * where the test goes keeps that decision.
 */
async function fold(p: Extract<Plan, { kind: "fold" }>) {
  const source = await prisma.subProduct.findUniqueOrThrow({
    where: { id: p.source.id },
    select: {
      parameters: {
        orderBy: [{ ordinal: "asc" }, { id: "asc" }],
        select: {
          id: true, nameEn: true, nameBn: true, slug: true, methodId: true,
          feePoisha: true, urgentFeePoisha: true, urgentFeeSource: true,
          discipline: true, sourceSection: true, limitText: true, limitKind: true,
          subParameters: {
            orderBy: { ordinal: "asc" },
            select: { label: true, limitText: true, limitKind: true, refBdsId: true, ordinal: true },
          },
          officeCapabilities: {
            select: { officeId: true, manner: true, labId: true, isActive: true },
          },
          preferences: { select: { officeId: true, toOfficeId: true, note: true } },
        },
      },
      packageFees: true,
      officeScopes: { select: { officeId: true, declaredByEmployeeId: true } },
    },
  });

  let copied = 0;
  for (const target of p.targets) {
    const existing = await prisma.testParameter.findMany({
      where: { subProductId: target.id },
      select: { nameEn: true, ordinal: true },
    });
    const taken = new Set(existing.map((x) => x.nameEn));
    let ordinal = Math.max(0, ...existing.map((x) => x.ordinal)) + 1;

    for (const src of source.parameters) {
      if (taken.has(src.nameEn)) continue; // already there — a re-run, or the wing named it too
      const created = await prisma.testParameter.create({
        data: {
          subProductId: target.id,
          nameEn: src.nameEn, nameBn: src.nameBn, slug: src.slug, methodId: src.methodId,
          feePoisha: src.feePoisha, urgentFeePoisha: src.urgentFeePoisha,
          urgentFeeSource: src.urgentFeeSource,
          discipline: src.discipline, sourceSection: src.sourceSection,
          limitText: src.limitText, limitKind: src.limitKind,
          ordinal: ordinal++,
          subParameters: { create: src.subParameters },
        },
        select: { id: true },
      });
      copied++;
      if (src.officeCapabilities.length)
        await prisma.parameterCapability.createMany({
          data: src.officeCapabilities.map((c) => ({ ...c, parameterId: created.id })),
          skipDuplicates: true,
        });
      if (src.preferences.length)
        await prisma.routingPreference.createMany({
          data: src.preferences.map((r) => ({ ...r, parameterId: created.id })),
          skipDuplicates: true,
        });
    }

    // The wing published its total for the whole product, so each variant is
    // one package at that price.
    for (const f of source.packageFees) {
      await prisma.subProductPackageFee.upsert({
        where: {
          subProductId_sourceSection: { subProductId: target.id, sourceSection: f.sourceSection },
        },
        create: {
          subProductId: target.id, sourceSection: f.sourceSection,
          statedNormalFeePoisha: f.statedNormalFeePoisha,
          statedUrgentFeePoisha: f.statedUrgentFeePoisha,
          summedNormalFeePoisha: f.summedNormalFeePoisha,
          turnaroundNormalDays: f.turnaroundNormalDays,
          turnaroundUrgentDays: f.turnaroundUrgentDays,
        },
        update: {},
      });
    }

    // An office that had taken the whole-product row on has taken on each
    // variant of it.
    if (source.officeScopes.length)
      await prisma.officeSubProductScope.createMany({
        data: source.officeScopes.map((o) => ({ ...o, subProductId: target.id })),
        skipDuplicates: true,
      });
  }

  const moved = await repoint(p.source.id, p.targets[0].id);
  await prisma.officeSubProductScope.deleteMany({ where: { subProductId: p.source.id } });
  await prisma.subProductPackageFee.deleteMany({ where: { subProductId: p.source.id } });
  // Emptied, not removed: the name is what the wing printed, and re-importing
  // that file writes its parameters straight back onto this row.
  await prisma.testParameter.deleteMany({ where: { subProductId: p.source.id } });
  await prisma.subProduct.update({
    where: { id: p.source.id },
    data: {
      foldedAt: new Date(),
      foldedNote:
        p.targets.length === 1
          ? `Folded into “${p.targets[0].nameEn}” — the same article named differently by another wing.`
          : `Folded into all ${p.targets.length} variants — this row named the whole product rather than a variant of it.`,
    },
  });
  return { copied, moved };
}

async function main() {
  const plans = await plan();
  const refusals = plans.filter((p): p is Extract<Plan, { kind: "refuse" }> => p.kind === "refuse");
  const work = plans.filter((p): p is Extract<Plan, { kind: "fold" }> => p.kind === "fold");

  console.log(`Rows to fold:       ${work.length}`);
  console.log(`Refused for review: ${refusals.length}\n`);

  for (const p of plans) {
    if (p.kind === "refuse") {
      console.log(`⚠ #${p.serial} ${p.product}\n    ${p.why}\n`);
      continue;
    }
    console.log(`#${p.serial} ${p.product}`);
    console.log(`    “${p.source.nameEn}” [${p.section}] — ${p.why}`);
    console.log(`    → its ${p.source.parameters.length} test(s) go to ${p.targets.length} row(s):`);
    for (const t of p.targets.slice(0, 4)) console.log(`        ${t.nameEn}`);
    if (p.targets.length > 4) console.log(`        … and ${p.targets.length - 4} more`);
    if (p.source._count.applicationEntries)
      console.log(`    → ${p.source._count.applicationEntries} application entr(y/ies) move to “${p.targets[0].nameEn}”`);
    console.log();
  }

  if (DRY) { console.log("--dry: nothing written."); return; }
  if (!work.length) { console.log("Nothing to do."); return; }

  for (const p of work) {
    const r = await fold(p);
    console.log(
      `✓ #${p.serial} ${p.product} — “${p.source.nameEn}” folded into ${p.targets.length} row(s); ` +
        `${r.copied} parameter(s) written, ${r.moved} application entr(y/ies) moved`,
    );
  }

  const left = (await plan()).filter((p) => p.kind === "fold").length;
  console.log(`\n${left} left to fold (a second run should find none).`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
