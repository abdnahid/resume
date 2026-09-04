/**
 * Imports a wing's test-parameter file into the Phase G catalogue.
 *
 *   npm run import:test-parameters -- --dry     report only, no writes
 *   npm run import:test-parameters              upsert
 *
 * Source: `utils/textile-parameter-list-sanitized.xlsx` — the Textile lab's
 * file with `Main Product` rewritten to the mandatory-315 product name. The
 * unedited original stays at `utils/textile-parameter-list.xlsx`.
 *
 * **One file per lab, and they merge.** Every wing produces this same format,
 * so the same (product, sub-product) will arrive again from the chemistry file
 * carrying *its* parameters. This importer therefore adds parameters to a
 * sub-product it finds and never creates a second copy — `(productId, nameEn)`
 * is the key that makes that safe. It follows that a file's "Total Test Fee"
 * column is that lab's **subtotal**, not the test fee: the fee an applicant
 * pays is the sum over every lab's parameters, which is why no total is stored.
 *
 * **The limit sits at the leaf.** A parameter with sub-parameters holds no
 * limit of its own; one without holds it directly. Asserted below, not assumed.
 *
 * Idempotent: upserts on natural keys and never deletes.
 */
import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import path from "node:path";
import { readGrid, resolveColumns, type ColumnSpec } from "./xlsx-grid";
import type { LabDiscipline, LimitKind } from "../../generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DRY = process.argv.includes("--dry");

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

/**
 * `--file=` and `--sheet=` check a wing's new file before it is trusted:
 * the column report and the consistency checks run against it without touching
 * the database. Writes are refused for anything but the configured source,
 * because the section and discipline below belong to that file alone.
 */
const FILE_OVERRIDE = arg("file");
const SHEET_OVERRIDE = arg("sheet");

/** Which lab's file this is. One per lab; the wing follows from the section. */
const SOURCE = {
  file: "utils/textile-parameter-list-sanitized.xlsx",
  sheetMatch: (n: string) => n.toLowerCase().includes("working"),
  section: "textile",
  discipline: "physical" as LabDiscipline,
};

/**
 * Columns are found by their header, never by position.
 *
 * **The wings' files do not agree on order.** The textile list runs
 * `Standard Limit | Method | Test Fee`; `lab-format-setup.xlsx` runs
 * `Standard Limit | Test Fee | Method`. Read by position, one file's methods
 * import as the other's fees — silently, because both columns are populated and
 * nothing downstream looks wrong until someone is billed for a method name.
 *
 * Only the columns actually read are declared, and all of them are required:
 * a file missing one is not the format we think it is, and `resolveColumns`
 * throws rather than guessing.
 */
const COLUMNS = {
  product: { exact: ["Main Product"] },
  // Spelled "Varient" in both files so far, so only the opening is dependable.
  subProduct: { prefix: ["Sub-Product", "Sub Product"] },
  standard: { exact: ["Standard"] },
  parameter: { exact: ["Parameter"] },
  subParameter: { exact: ["Sub Parameter", "Sub-Parameter"] },
  limit: { exact: ["Standard Limit"] },
  method: { exact: ["Method", "Test Method"] },
  fee: { exact: ["Test Fee"] },
  normalDays: { exact: ["Duration of Test (Normal)"] },
  urgentDays: { exact: ["Duration of Test (Urgent)"] },
} satisfies Record<string, ColumnSpec>;

type ColKey = keyof typeof COLUMNS;

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);

/**
 * Trailing punctuation is a typing slip, not a different method. The textile
 * file writes the same standard as both "BDS 949" and "BDS 949:", and treating
 * those as two methods would split one procedure's capability rows in half —
 * a lab that can run it would appear able to run only some of it.
 */
/**
 * Built from the product's serial rather than its name. Names run long — the
 * mandatory list's #246 is 69 characters before the sub-product is appended —
 * and truncating a `name--name` slug silently cuts off the half that
 * distinguishes one sub-product from the next.
 */
const subProductSlug = (serial: number, subName: string) =>
  `p${serial}-${slugify(subName).slice(0, 100)}`;

const normalizeMethod = (s: string) => s.replace(/[:\-–—\s]+$/, "").trim();

/** Taka in the sheet, poisha in the database. Never a float. */
function toPoisha(raw: string): number | null {
  const n = raw.replace(/[^0-9.]/g, "");
  if (!n) return null;
  return Math.round(Number(n) * 100);
}

function toDays(raw: string): number | null {
  const m = raw.match(/\d+/);
  return m ? Number(m[0]) : null;
}

/**
 * A single text column cannot distinguish these, and they behave differently —
 * a `declared` value is supplied by the manufacturer and confirmed by the test,
 * so it becomes a form field rather than a pass/fail constant.
 */
function classifyLimit(raw: string): { kind: LimitKind; refNumber: string | null } {
  const v = raw.trim();
  if (!v) return { kind: "unspecified", refNumber: null };
  if (/^\*?-?\s*text\s*field\s*-?\*?$/i.test(v) || /as\s+declared/i.test(v))
    return { kind: "declared", refNumber: null };
  const ref = v.match(/as\s+per\s+(BDS\s*[0-9:\s-]+)/i);
  if (ref) return { kind: "cross_reference", refNumber: ref[1].replace(/\s+/g, " ").trim() };
  return { kind: "rule", refNumber: null };
}

type SubParamRow = { label: string; limit: string; ordinal: number };
type ParamRow = {
  name: string; method: string; feePoisha: number;
  limit: string; ordinal: number; subParams: SubParamRow[];
};
type SubProductRow = {
  productName: string; name: string; standard: string;
  normalDays: number | null; urgentDays: number | null;
  ordinal: number; params: ParamRow[];
};

function parse(): {
  subProducts: SubProductRow[];
  dataRows: number;
  problems: string[];
  columns: Record<ColKey, number>;
  sheetName: string;
} {
  const grid = readGrid(
    path.join(process.cwd(), FILE_OVERRIDE ?? SOURCE.file),
    SHEET_OVERRIDE
      ? (n) => n.toLowerCase() === SHEET_OVERRIDE.toLowerCase()
      : FILE_OVERRIDE
        ? undefined
        : SOURCE.sheetMatch,
  );
  const C = resolveColumns(grid, COLUMNS);
  const problems: string[] = [];
  const byKey = new Map<string, SubProductRow>();
  let dataRows = 0;

  for (let r = 1; r <= grid.lastRow; r++) {
    const productName = grid.at(r, C.product);
    const paramName = grid.at(r, C.parameter);
    if (!productName || !paramName) continue;
    dataRows++;

    const subName = grid.at(r, C.subProduct);
    const spKey = `${productName}||${subName}`;
    let sp = byKey.get(spKey);
    if (!sp) {
      sp = {
        productName, name: subName, standard: grid.at(r, C.standard),
        normalDays: toDays(grid.at(r, C.normalDays)),
        urgentDays: toDays(grid.at(r, C.urgentDays)),
        ordinal: byKey.size, params: [],
      };
      byKey.set(spKey, sp);
    }

    const fee = toPoisha(grid.at(r, C.fee));
    if (fee === null) { problems.push(`row ${r + 1}: no fee for "${paramName}"`); continue; }

    let p = sp.params.find((x) => x.name === paramName);
    if (!p) {
      p = { name: paramName, method: normalizeMethod(grid.at(r, C.method)), feePoisha: fee,
            limit: "", ordinal: sp.params.length, subParams: [] };
      sp.params.push(p);
    } else {
      // The fee and method are merged across a parameter's sub-parameters, so
      // every row of one parameter must agree. If they ever disagree the sheet
      // is saying two things and the importer must not pick one.
      if (p.feePoisha !== fee)
        problems.push(`${sp.name} » ${paramName}: two fees (${p.feePoisha} vs ${fee})`);
      const m = normalizeMethod(grid.at(r, C.method));
      if (m && p.method && m !== p.method)
        problems.push(`${sp.name} » ${paramName}: two methods ("${p.method}" vs "${m}")`);
    }

    const label = grid.at(r, C.subParameter);
    const limit = grid.at(r, C.limit);
    if (label) {
      if (p.subParams.some((s) => s.label === label))
        problems.push(`${sp.name} » ${paramName} » ${label}: duplicate sub-parameter`);
      else p.subParams.push({ label, limit, ordinal: p.subParams.length });
    } else {
      if (p.limit && p.limit !== limit)
        problems.push(`${sp.name} » ${paramName}: two limits with no sub-parameter`);
      p.limit = limit;
    }
  }

  // Two designations that slugify alike would collide on TestMethod.slug and
  // blow up mid-write. Catch it here, where nothing has been written yet.
  const bySlug = new Map<string, Set<string>>();
  for (const sp of byKey.values())
    for (const p of sp.params)
      if (p.method) {
        const k = slugify(p.method);
        if (!bySlug.has(k)) bySlug.set(k, new Set());
        bySlug.get(k)!.add(p.method);
      }
  for (const [slug, set] of bySlug)
    if (set.size > 1)
      problems.push(`method slug "${slug}" is shared by ${set.size} designations: ${[...set].map((x) => JSON.stringify(x)).join(", ")}`);

  // Sub-product slugs must be unique across the whole catalogue, not just
  // within a product. Checked here so a collision is a report, not a crash
  // halfway through writing.
  const spSlugs = new Map<string, string[]>();
  for (const sp of byKey.values()) {
    const k = `${sp.productName}||${slugify(sp.name).slice(0, 100)}`;
    if (!spSlugs.has(k)) spSlugs.set(k, []);
    spSlugs.get(k)!.push(sp.name);
  }
  for (const [k, names] of spSlugs)
    if (names.length > 1)
      problems.push(`sub-product slug "${k}" is shared by: ${names.map((n) => JSON.stringify(n)).join(", ")}`);

  // The rule the model exists to enforce.
  for (const sp of byKey.values())
    for (const p of sp.params)
      if (p.subParams.length && p.limit)
        problems.push(`${sp.name} » ${p.name}: has sub-parameters AND its own limit`);

  return { subProducts: [...byKey.values()], dataRows, problems, columns: C, sheetName: grid.sheetName };
}

async function main() {
  const { subProducts, dataRows, problems, columns, sheetName } = parse();
  const params = subProducts.flatMap((s) => s.params);
  const subParams = params.flatMap((p) => p.subParams);

  console.log(`Source     ${FILE_OVERRIDE ?? SOURCE.file}  [${sheetName}]`);
  console.log(
    `Columns    ${(Object.keys(columns) as ColKey[])
      .map((k) => `${k}=${String.fromCharCode(65 + columns[k])}`)
      .join("  ")}`,
  );
  console.log(`Section    ${SOURCE.section} (${SOURCE.discipline})`);
  console.log(`Data rows  ${dataRows}`);
  console.log(`Products   ${new Set(subProducts.map((s) => s.productName)).size}`);
  console.log(`Sub-prods  ${subProducts.length}`);
  console.log(`Parameters ${params.length}`);
  console.log(`Sub-params ${subParams.length}`);
  console.log(`Methods    ${new Set(params.map((p) => p.method).filter(Boolean)).size}`);
  const kinds = new Map<string, number>();
  for (const x of [...subParams.map((s) => s.limit), ...params.filter((p) => !p.subParams.length).map((p) => p.limit)])
    kinds.set(classifyLimit(x).kind, (kinds.get(classifyLimit(x).kind) ?? 0) + 1);
  console.log(`Limits     ${[...kinds].map(([k, n]) => `${k} ${n}`).join(", ")}`);

  if (problems.length) {
    console.log(`\n${problems.length} problem(s) — nothing written:`);
    problems.slice(0, 25).forEach((p) => console.log("  •", p));
    process.exitCode = 1;
    return;
  }
  console.log("\nConsistency checks passed.");

  // Resolve every product before writing anything: a partial import would leave
  // sub-products whose parameters live in a file nobody ran.
  const products = await prisma.product.findMany({ select: { id: true, nameEn: true, serial: true } });
  const byName = new Map(products.map((p) => [p.nameEn.trim(), p]));
  const missing = [...new Set(subProducts.map((s) => s.productName))].filter((n) => !byName.has(n));
  if (missing.length) {
    console.log(`\n${missing.length} product name(s) not in the mandatory 315 — nothing written:`);
    missing.forEach((m) => console.log("  •", m));
    process.exitCode = 1;
    return;
  }

  if (DRY) { console.log("\n--dry: no writes."); return; }
  if (FILE_OVERRIDE || SHEET_OVERRIDE) {
    console.log("\n--file/--sheet is for checking a file, not importing one.");
    console.log("The section and discipline are configured for the source above; add a SOURCE block to import a new wing.");
    process.exitCode = 1;
    return;
  }

  const bdsRows = await prisma.bds.findMany({ select: { id: true, number: true } });
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const bdsByNumber = new Map(bdsRows.map((b) => [norm(b.number), b.id]));
  const resolveBds = (designation: string) => bdsByNumber.get(norm(designation)) ?? null;

  // ── Methods ────────────────────────────────────────────────────────────────
  const methodNames = [...new Set(params.map((p) => p.method).filter(Boolean))];
  for (const designation of methodNames) {
    // Keyed on the slug, not the designation: a row written from an earlier,
    // un-normalised run ("BDS 949:") carries the same slug, so keying on the
    // slug repairs its designation instead of colliding with it.
    await prisma.testMethod.upsert({
      where: { slug: slugify(designation) },
      create: { designation, slug: slugify(designation), bdsId: resolveBds(designation) },
      update: { designation, bdsId: resolveBds(designation) },
    });
  }
  const methods = new Map(
    (await prisma.testMethod.findMany({ select: { id: true, designation: true } }))
      .map((m) => [m.designation, m.id]),
  );
  console.log(`\n✓ methods      ${methodNames.length}`);

  // ── Sub-products, parameters, sub-parameters ───────────────────────────────
  let nSub = 0, nParam = 0, nLine = 0;
  for (const sp of subProducts) {
    const product = byName.get(sp.productName)!;
    const row = await prisma.subProduct.upsert({
      where: { productId_nameEn: { productId: product.id, nameEn: sp.name } },
      create: {
        productId: product.id, nameEn: sp.name,
        slug: subProductSlug(product.serial, sp.name),
        standardAsPrinted: sp.standard || null, bdsId: resolveBds(sp.standard),
        turnaroundNormalDays: sp.normalDays, turnaroundUrgentDays: sp.urgentDays,
        ordinal: sp.ordinal,
      },
      update: {
        standardAsPrinted: sp.standard || null,
        turnaroundNormalDays: sp.normalDays, turnaroundUrgentDays: sp.urgentDays,
      },
      select: { id: true },
    });
    nSub++;

    for (const p of sp.params) {
      const own = p.subParams.length ? { kind: "unspecified" as LimitKind, refNumber: null } : classifyLimit(p.limit);
      const param = await prisma.testParameter.upsert({
        where: { subProductId_nameEn: { subProductId: row.id, nameEn: p.name } },
        create: {
          subProductId: row.id, nameEn: p.name, slug: slugify(p.name),
          methodId: p.method ? (methods.get(p.method) ?? null) : null,
          feePoisha: p.feePoisha, discipline: SOURCE.discipline,
          sourceSection: SOURCE.section, ordinal: p.ordinal,
          limitText: p.subParams.length ? null : p.limit || null,
          limitKind: own.kind,
        },
        update: {
          methodId: p.method ? (methods.get(p.method) ?? null) : null,
          feePoisha: p.feePoisha, discipline: SOURCE.discipline,
          sourceSection: SOURCE.section, ordinal: p.ordinal,
          limitText: p.subParams.length ? null : p.limit || null,
          limitKind: own.kind,
        },
        select: { id: true },
      });
      nParam++;

      if (p.subParams.length) {
        // Batched: a round trip to the remote database costs ~half a second.
        await prisma.testSubParameter.deleteMany({ where: { parameterId: param.id } });
        await prisma.testSubParameter.createMany({
          data: p.subParams.map((s) => {
            const c = classifyLimit(s.limit);
            return {
              parameterId: param.id, label: s.label, ordinal: s.ordinal,
              limitText: s.limit || null, limitKind: c.kind,
              refBdsId: c.refNumber ? resolveBds(c.refNumber) : null,
            };
          }),
        });
        nLine += p.subParams.length;
      }
    }
    if (nSub % 20 === 0) console.log(`  … ${nSub}/${subProducts.length} sub-products`);
  }

  console.log(`✓ sub-products ${nSub}`);
  console.log(`✓ parameters   ${nParam}`);
  console.log(`✓ sub-params   ${nLine}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
