/**
 * Seeds the salary reference data: the pay scale, the government house rent
 * slabs, and the office → house-rent-zone mapping.
 *
 * Run with: npm run seed:salary
 *
 * Idempotent — everything upserts on a natural key, so re-running after you
 * correct a spreadsheet just restates the rows.
 *
 * Sources, both read at seed time rather than transcribed into this file, so
 * that fixing the spreadsheet is all it takes to fix the data:
 *
 *   utils/rent.xlsx      house rent monthly rate table   (present)
 *   utils/payscale.xlsx  the gazette pay scale grid      (optional — see below)
 *
 * If `utils/payscale.xlsx` is absent the scale row is still created but left
 * `verified: false` with no steps, and fixation falls back to typing basic
 * salary by hand. Drop the gazette grid in and re-run to light up grade+step
 * selection.
 */
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as XLSX from "xlsx";
import * as fs from "node:fs";
import * as path from "node:path";
import "dotenv/config";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

type Zone = "dhaka" | "divisional_city" | "other_district";

const SCALE_CODE = "NPS-2015";
const UTILS = path.join(__dirname, "..", "utils");

// ─── Spreadsheet helpers ─────────────────────────────────────────────────────

function readGrid(file: string): string[][] | null {
  if (!fs.existsSync(file)) return null;
  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: false,
  });
  return rows.map((r) => r.map((c) => (c === undefined || c === null ? "" : String(c).trim())));
}

/** "Upto 9700" · "9701 to 16000" · "35501 and above" → a basic-salary range. */
function parseBasicRange(cell: string): { min: number; max: number | null } | null {
  const text = cell.toLowerCase().replace(/,/g, "");

  const upto = text.match(/^up\s*to\s*(\d+)/);
  if (upto) return { min: 0, max: Number(upto[1]) };

  const above = text.match(/^(\d+)\s*(?:and\s*)?above/);
  if (above) return { min: Number(above[1]), max: null };

  const range = text.match(/^(\d+)\s*(?:to|-|–)\s*(\d+)/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };

  return null;
}

/** "65 % of basic but not less than 5600" → { percent: 65, minAmount: 5600 }. */
function parseRate(cell: string): { percent: number; minAmount: number } | null {
  const text = cell.replace(/,/g, "");
  const pct = text.match(/(\d+(?:\.\d+)?)\s*%/);
  const floor = text.match(/not\s+less\s+than\s+(\d+)/i);
  if (!pct) return null;
  return {
    percent: Math.round(Number(pct[1])),
    minAmount: floor ? Number(floor[1]) : 0,
  };
}

/**
 * Which zone a header cell names. The middle column lists its eight cities
 * explicitly, so match on those rather than on the word "divisional" — the
 * table never uses it.
 */
function zoneForHeader(header: string): Zone | null {
  const h = header.toLowerCase();
  if (!h) return null;
  if (h.includes("dhaka")) return "dhaka";
  if (h.includes("other")) return "other_district";
  if (/chittagong|chattogram|khulna|rajshahi|sylhet/.test(h)) return "divisional_city";
  return null;
}

// ─── House rent slabs ────────────────────────────────────────────────────────

async function seedHouseRent(scaleId: number): Promise<number> {
  const file = path.join(UTILS, "rent.xlsx");
  const grid = readGrid(file);
  if (!grid) {
    console.log("  ! utils/rent.xlsx not found — no house rent slabs seeded");
    return 0;
  }

  // Find the row that names the zones, then the data rows beneath it.
  let headerRow = -1;
  for (let i = 0; i < grid.length; i++) {
    const zones = grid[i].map(zoneForHeader).filter(Boolean);
    if (zones.length >= 2) {
      headerRow = i;
      break;
    }
  }
  if (headerRow === -1) throw new Error("rent.xlsx: could not find the zone header row");

  const colZone = new Map<number, Zone>();
  grid[headerRow].forEach((cell, idx) => {
    const z = zoneForHeader(cell);
    if (z) colZone.set(idx, z);
  });

  let count = 0;
  for (let i = headerRow + 1; i < grid.length; i++) {
    const range = parseBasicRange(grid[i][0] ?? "");
    if (!range) continue;

    for (const [idx, zone] of colZone) {
      const rate = parseRate(grid[i][idx] ?? "");
      if (!rate) continue;

      await p.houseRentRule.upsert({
        where: { scaleId_zone_minBasic: { scaleId, zone, minBasic: range.min } },
        update: { maxBasic: range.max, percent: rate.percent, minAmount: rate.minAmount },
        create: {
          scaleId,
          zone,
          minBasic: range.min,
          maxBasic: range.max,
          percent: rate.percent,
          minAmount: rate.minAmount,
        },
      });
      count++;
    }
  }
  return count;
}

// ─── Pay scale steps ─────────────────────────────────────────────────────────

/**
 * Accepts either shape:
 *   long  — columns headed grade / step / amount (or "basic")
 *   grid  — first column the grade, remaining columns the steps in order
 */
async function seedScaleSteps(scaleId: number): Promise<number> {
  const file = path.join(UTILS, "payscale.xlsx");
  const grid = readGrid(file);
  if (!grid) {
    console.log(
      "  ! utils/payscale.xlsx not found — scale left unverified with no steps.\n" +
        "    Fixation will ask for basic salary by hand until it is supplied.",
    );
    return 0;
  }

  const header = grid[0].map((c) => c.toLowerCase());
  const gradeCol = header.findIndex((c) => c.includes("grade"));
  const stepCol = header.findIndex((c) => c.includes("step"));
  const amountCol = header.findIndex((c) => c.includes("amount") || c.includes("basic"));

  const rows: { grade: number; step: number; amount: number }[] = [];

  if (gradeCol !== -1 && stepCol !== -1 && amountCol !== -1) {
    // Long format.
    for (const r of grid.slice(1)) {
      const grade = Number(r[gradeCol]);
      const step = Number(r[stepCol]);
      const amount = Number(String(r[amountCol]).replace(/,/g, ""));
      if (!Number.isInteger(grade) || !Number.isInteger(step) || !amount) continue;
      rows.push({ grade, step, amount });
    }
  } else {
    // Grid format: one row per grade, one column per step.
    for (const r of grid.slice(1)) {
      const grade = Number(String(r[0]).replace(/[^\d]/g, ""));
      if (!Number.isInteger(grade) || grade < 1 || grade > 20) continue;
      let step = 0;
      for (const cell of r.slice(1)) {
        const amount = Number(String(cell).replace(/,/g, ""));
        if (!amount) continue;
        rows.push({ grade, step, amount });
        step++;
      }
    }
  }

  if (!rows.length) throw new Error("payscale.xlsx: no usable rows found");

  for (const row of rows) {
    await p.payScaleStep.upsert({
      where: { scaleId_grade_step: { scaleId, grade: row.grade, step: row.step } },
      update: { amount: row.amount },
      create: { scaleId, ...row },
    });
  }
  return rows.length;
}

// ─── Office zones ────────────────────────────────────────────────────────────

/**
 * The eight cities the rent table's middle column names. Mymensingh is a
 * divisional office but is *not* in that list, so it falls to other_district —
 * flagged in the run log because it is the one judgment call here.
 */
const DIVISIONAL_CITIES = [
  "chittagong", "chattogram", "khulna", "rajshahi",
  "sylhet", "barisal", "barishal", "rangpur", "gazipur", "narayanganj",
];

/**
 * Matches on the office *name* only, never the address. Cumilla's address is on
 * the "Dhaka-Chittagong Highway" and Naogaon's is at a "Dhaka Bus Stand" — both
 * landed in the Dhaka zone when addresses were included, which would have
 * overpaid house rent for two districts' staff. Every office is named
 * "<kind> Office, BSTI, <city>", so the name alone is unambiguous.
 */
function zoneForOffice(nameEn: string): Zone {
  const name = nameEn.toLowerCase();
  if (name.includes("dhaka")) return "dhaka";
  if (DIVISIONAL_CITIES.some((c) => name.includes(c))) return "divisional_city";
  return "other_district";
}

async function seedOfficeZones(): Promise<Record<Zone, string[]>> {
  const offices = await p.office.findMany({ orderBy: { id: "asc" } });
  const byZone: Record<Zone, string[]> = {
    dhaka: [],
    divisional_city: [],
    other_district: [],
  };

  for (const o of offices) {
    const zone = zoneForOffice(o.nameEn);
    await p.office.update({ where: { id: o.id }, data: { houseRentZone: zone } });
    byZone[zone].push(o.nameEn);
  }
  return byZone;
}

// ─── House rent head ─────────────────────────────────────────────────────────

/**
 * The only head seeded here. Its rule comes from your own rent.xlsx, so it is
 * safe to create; every other allowance and deduction is left for an operator
 * to add at /hr/listing/salary-heads, because BSTI's actual head list and rates
 * are not in this repo and guessing them would put wrong money on a pay order.
 */
async function seedHouseRentHead() {
  await p.salaryHead.upsert({
    where: { code: "HOUSE_RENT" },
    update: { basis: "house_rent_rule", kind: "earning" },
    create: {
      code: "HOUSE_RENT",
      nameEn: "House Rent Allowance",
      nameBn: "বাড়ি ভাড়া ভাতা",
      kind: "earning",
      basis: "house_rent_rule",
      isDefault: true,
      sortOrder: 10,
      note: "Government rate — a percent of basic with a floor, by office zone.",
    },
  });
}

// ─── Backfill ────────────────────────────────────────────────────────────────

/**
 * Fixation rows that predate versioning carry no sheet totals — they were just
 * a grade and a basic, and `SalaryProcess` paid the basic verbatim. Set their
 * gross and net to the basic so they keep meaning exactly what they meant
 * before, rather than reading as a ৳0 salary.
 *
 * Deliberately does *not* attach the house rent head. Backfilling an allowance
 * onto a settled record would invent money nobody approved; those employees
 * need a fresh fixation raised through the screen.
 *
 * Guarded on `netSalary: 0`, so re-running never touches a real sheet.
 */
async function backfillLegacyFixations(): Promise<number> {
  const legacy = await p.salaryFixation.findMany({
    where: { netSalary: 0 },
    select: { id: true, basicSalary: true },
  });
  for (const f of legacy) {
    await p.salaryFixation.update({
      where: { id: f.id },
      data: { grossEarning: f.basicSalary, netSalary: f.basicSalary },
    });
  }
  return legacy.length;
}

/** Same story for salary months processed before the breakdown existed. */
async function backfillLegacyProcesses(): Promise<number> {
  const legacy = await p.salaryProcess.findMany({
    where: { basicSalary: 0 },
    select: { id: true, netSalary: true },
  });
  for (const r of legacy) {
    await p.salaryProcess.update({
      where: { id: r.id },
      data: { basicSalary: r.netSalary, grossEarning: r.netSalary },
    });
  }
  return legacy.length;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding salary reference data…\n");

  const scale = await p.payScale.upsert({
    where: { code: SCALE_CODE },
    update: {},
    create: {
      code: SCALE_CODE,
      nameEn: "National Pay Scale 2015",
      nameBn: "জাতীয় বেতন স্কেল ২০১৫",
      effectiveFrom: "07-01-2015",
      effectiveTo: null,
      isActive: true,
      verified: false,
      incrementNote: "5% annual increment",
    },
  });
  console.log(`  pay scale        ${scale.code} (id ${scale.id})`);

  const steps = await seedScaleSteps(scale.id);
  if (steps) console.log(`  scale steps      ${steps} rows`);

  // A scale is only trusted once its grid is loaded.
  const stepCount = await p.payScaleStep.count({ where: { scaleId: scale.id } });
  await p.payScale.update({
    where: { id: scale.id },
    data: { verified: stepCount > 0 },
  });

  const slabs = await seedHouseRent(scale.id);
  console.log(`  house rent slabs ${slabs} rows`);

  await seedHouseRentHead();
  console.log("  salary heads     House Rent Allowance");

  const zones = await seedOfficeZones();
  console.log(
    `  office zones     ${zones.dhaka.length} Dhaka · ` +
      `${zones.divisional_city.length} divisional city · ` +
      `${zones.other_district.length} other district`,
  );
  const fixationsFixed = await backfillLegacyFixations();
  const processesFixed = await backfillLegacyProcesses();
  if (fixationsFixed || processesFixed) {
    console.log(
      `  backfill         ${fixationsFixed} fixation(s), ${processesFixed} processed month(s) given gross/net = basic`,
    );
  }

  const mymensingh = zones.other_district.find((n) => /mymensingh/i.test(n));
  if (mymensingh) {
    console.log(
      `\n  note: "${mymensingh}" is classified other_district — it is a\n` +
        "        divisional office, but rent.xlsx does not list Mymensingh among\n" +
        "        the eight cities in its middle column. Change it by hand if that\n" +
        "        is wrong.",
    );
  }
  if (!stepCount) {
    console.log(
      "\n  ! The pay scale has no steps and is marked unverified.\n" +
        "    Drop the gazette grid in utils/payscale.xlsx and re-run.",
    );
  }
  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => p.$disconnect());
