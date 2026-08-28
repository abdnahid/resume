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
import { buildGrid } from "./data/nps-2015";
import { generateMemoNo, numberToBengaliWords } from "../lib/bengali";
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
 * Seed the pay scale grid.
 *
 * The NPS-2015 grid is generated from the verified rule in
 * `prisma/data/nps-2015.ts` (read out of `utils/Increment-Chart-2015.pdf`),
 * which asserts each grade lands on its published maximum.
 *
 * `utils/payscale.xlsx` still wins if present, so a future scale — or a
 * correction — can be dropped in without a code change. It accepts either
 * shape: columns headed grade / step / amount, or one row per grade with the
 * steps across.
 */
async function seedScaleSteps(scaleId: number): Promise<{ count: number; source: string }> {
  const file = path.join(UTILS, "payscale.xlsx");
  const grid = readGrid(file);

  let rows: { grade: number; step: number; amount: number }[];
  let source: string;

  if (grid) {
    const header = grid[0].map((c) => c.toLowerCase());
    const gradeCol = header.findIndex((c) => c.includes("grade"));
    const stepCol = header.findIndex((c) => c.includes("step"));
    const amountCol = header.findIndex((c) => c.includes("amount") || c.includes("basic"));

    rows = [];
    if (gradeCol !== -1 && stepCol !== -1 && amountCol !== -1) {
      for (const r of grid.slice(1)) {
        const grade = Number(r[gradeCol]);
        const step = Number(r[stepCol]);
        const amount = Number(String(r[amountCol]).replace(/,/g, ""));
        if (!Number.isInteger(grade) || !Number.isInteger(step) || !amount) continue;
        rows.push({ grade, step, amount });
      }
    } else {
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
    source = "utils/payscale.xlsx";
  } else {
    // Throws if any grade fails to land on its published maximum.
    rows = buildGrid();
    source = "the verified NPS-2015 chart rule";
  }

  for (const row of rows) {
    await p.payScaleStep.upsert({
      where: { scaleId_grade_step: { scaleId, grade: row.grade, step: row.step } },
      update: { amount: row.amount },
      create: { scaleId, ...row },
    });
  }
  return { count: rows.length, source };
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

// ─── Banking ─────────────────────────────────────────────────────────────────

/**
 * Banks BSTI deals with. Only Sonali is in use; the others exist so the office
 * setup screen offers a choice rather than a single locked row, and so a change
 * of bank is a selection rather than a migration.
 */
const BANKS = [
  { nameEn: "Sonali Bank PLC", nameBn: "সোনালী ব্যাংক পিএলসি" },
  { nameEn: "Janata Bank PLC", nameBn: "জনতা ব্যাংক পিএলসি" },
  { nameEn: "Agrani Bank PLC", nameBn: "অগ্রণী ব্যাংক পিএলসি" },
  { nameEn: "Rupali Bank PLC", nameBn: "রূপালী ব্যাংক পিএলসি" },
];

/**
 * Branch details per office.
 *
 * **These are improvised.** Only Head Office's is real — it is the block the
 * bank advice used to hardcode. Every other row is a plausible corporate branch
 * in the office's own city, written so the letter is coherent, and marked
 * `isPlaceholder` so the office setup screen can flag it. Confirm each against
 * the bank before a letter goes out.
 *
 * Keyed by office id.
 */
const BRANCHES: Record<number, { branchBn: string; addressBn: string; account: string }> = {
  6:  { branchBn: "তেজগাঁও শিল্প এলাকা শাখা", addressBn: "তেজগাঁও, ঢাকা-১২০৮", account: "০১২৪২০০০০০৫০৬" },
  19: { branchBn: "তেজগাঁও শিল্প এলাকা শাখা", addressBn: "তেজগাঁও, ঢাকা-১২০৮", account: "০১২৪২০০০০০৫০৭" },
  1:  { branchBn: "বরিশাল কর্পোরেট শাখা", addressBn: "সদর রোড, বরিশাল-৮২০০", account: "০১০১২০০০০১১০১" },
  2:  { branchBn: "সিলেট কর্পোরেট শাখা", addressBn: "জিন্দাবাজার, সিলেট-৩১০০", account: "০১০২২০০০০১১০২" },
  3:  { branchBn: "আগ্রাবাদ কর্পোরেট শাখা", addressBn: "আগ্রাবাদ বাণিজ্যিক এলাকা, চট্টগ্রাম-৪১০০", account: "০১০৩২০০০০১১০৩" },
  4:  { branchBn: "রংপুর কর্পোরেট শাখা", addressBn: "স্টেশন রোড, রংপুর-৫৪০০", account: "০১০৪২০০০০১১০৪" },
  5:  { branchBn: "ময়মনসিংহ কর্পোরেট শাখা", addressBn: "সদর, ময়মনসিংহ-২২০০", account: "০১০৫২০০০০১১০৫" },
  7:  { branchBn: "কুমিল্লা কর্পোরেট শাখা", addressBn: "কান্দিরপাড়, কুমিল্লা-৩৫০০", account: "০১০৭২০০০০১১০৭" },
  8:  { branchBn: "ফরিদপুর শাখা", addressBn: "মুজিব সড়ক, ফরিদপুর-৭৮০০", account: "০১০৮২০০০০১১০৮" },
  9:  { branchBn: "কক্সবাজার শাখা", addressBn: "প্রধান সড়ক, কক্সবাজার-৪৭০০", account: "০১০৯২০০০০১১০৯" },
  10: { branchBn: "কুষ্টিয়া শাখা", addressBn: "এন এস রোড, কুষ্টিয়া-৭০০০", account: "০১১০২০০০০১১১০" },
  11: { branchBn: "নওগাঁ শাখা", addressBn: "সদর, নওগাঁ-৬৫০০", account: "০১১১২০০০০১১১১" },
  12: { branchBn: "গাজীপুর শাখা", addressBn: "জয়দেবপুর, গাজীপুর-১৭০০", account: "০১১২২০০০০১১১২" },
  13: { branchBn: "পটুয়াখালী শাখা", addressBn: "সদর রোড, পটুয়াখালী-৮৬০০", account: "০১১৩২০০০০১১১৩" },
  14: { branchBn: "পাবনা শাখা", addressBn: "আব্দুল হামিদ রোড, পাবনা-৬৬০০", account: "০১১৪২০০০০১১১৪" },
  15: { branchBn: "গোপালগঞ্জ শাখা", addressBn: "সদর, গোপালগঞ্জ-৮১০০", account: "০১১৫২০০০০১১১৫" },
  16: { branchBn: "দিনাজপুর শাখা", addressBn: "স্টেশন রোড, দিনাজপুর-৫২০০", account: "০১১৬২০০০০১১১৬" },
  17: { branchBn: "নোয়াখালী শাখা", addressBn: "মাইজদী কোর্ট, নোয়াখালী-৩৮০০", account: "০১১৭২০০০০১১১৭" },
  18: { branchBn: "খুলনা কর্পোরেট শাখা", addressBn: "কে ডি এ এভিনিউ, খুলনা-৯১০০", account: "০১১৮২০০০০১১১৮" },
  20: { branchBn: "নরসিংদী শাখা", addressBn: "সদর, নরসিংদী-১৬০০", account: "০১২০২০০০০১১২০" },
  21: { branchBn: "যশোর শাখা", addressBn: "এম কে রোড, যশোর-৭৪০০", account: "০১২১২০০০০১১২১" },
  22: { branchBn: "রাজশাহী কর্পোরেট শাখা", addressBn: "সাহেব বাজার, রাজশাহী-৬১০০", account: "০১২২২০০০০১১২২" },
  23: { branchBn: "নারায়ণগঞ্জ কর্পোরেট শাখা", addressBn: "বি বি রোড, নারায়ণগঞ্জ-১৪০০", account: "০১২৩২০০০০১১২৩" },
};

/** Who the advice is addressed to at the branch. */
const RECIPIENT_BN = "সহকারী মহাব্যবস্থাপক";

async function seedBanking(): Promise<{ banks: number; accounts: number; placeholders: number }> {
  for (const b of BANKS) {
    await p.bank.upsert({ where: { nameEn: b.nameEn }, update: { nameBn: b.nameBn }, create: b });
  }
  const sonali = await p.bank.findUniqueOrThrow({ where: { nameEn: "Sonali Bank PLC" } });

  const offices = await p.office.findMany({ select: { id: true } });
  let accounts = 0;
  for (const o of offices) {
    const branch = BRANCHES[o.id];
    if (!branch) continue;
    // Only creates. An office whose details have been corrected on screen is
    // never overwritten by a re-run.
    await p.officeBankAccount.upsert({
      where: { officeId: o.id },
      update: {},
      create: {
        officeId: o.id,
        bankId: sonali.id,
        recipientDesignationBn: RECIPIENT_BN,
        branchNameBn: branch.branchBn,
        branchAddressBn: branch.addressBn,
        accountNo: branch.account,
        // Head Office's block is the one the letter already used; the rest are
        // improvised and must be confirmed.
        isPlaceholder: o.id !== 6,
      },
    });
    accounts++;
  }
  const placeholders = await p.officeBankAccount.count({ where: { isPlaceholder: true } });
  return { banks: BANKS.length, accounts, placeholders };
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

/**
 * Fixations made before the pay scale grid existed carry no `step`. Where the
 * stored basic is exactly a rung of its grade, recover the step so the row is
 * on scale; where it is not, leave it null — the fixation screen then asks an
 * operator to pick the right step rather than guessing on their behalf.
 */
async function backfillFixationSteps(scaleId: number): Promise<{ matched: number; offGrid: number }> {
  const [rows, steps] = await Promise.all([
    p.salaryFixation.findMany({ where: { step: null }, select: { id: true, grade: true, basicSalary: true } }),
    p.payScaleStep.findMany({ where: { scaleId } }),
  ]);
  let matched = 0;
  let offGrid = 0;
  for (const f of rows) {
    const cell = steps.find((s) => s.grade === f.grade && s.amount === f.basicSalary);
    if (!cell) {
      offGrid++;
      continue;
    }
    await p.salaryFixation.update({
      where: { id: f.id },
      data: { step: cell.step, scaleId },
    });
    matched++;
  }
  return { matched, offGrid };
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

/**
 * Bank advices predate per-office scoping. The two that exist were labelled
 * Dhaka in their memo while totalling every office's staff, so they are pinned
 * to Head Office and their totals recomputed from that office's rows alone —
 * which is what the letter always claimed to be.
 *
 * Guarded on `officeId: null`, so a re-run never touches a real advice.
 */
async function backfillBankAdviceOffices(): Promise<number> {
  const head = await p.office.findFirst({
    where: { type: "head" },
    select: { id: true, nameBn: true },
  });
  if (!head) return 0;

  const legacy = await p.bankAdvice.findMany({ where: { officeId: null } });
  for (const a of legacy) {
    const rows = await p.salaryProcess.findMany({
      where: { month: a.month, year: a.year, employee: { officeId: head.id } },
      select: { netSalary: true },
    });
    const total = rows.reduce((sum, r) => sum + r.netSalary, 0);
    await p.bankAdvice.update({
      where: { id: a.id },
      data: {
        officeId: head.id,
        memoNo: generateMemoNo(a.month, a.year, head.nameBn),
        totalAmount: total,
        totalInWords: numberToBengaliWords(total),
        employeeCount: rows.length,
      },
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
  console.log(`  scale steps      ${steps.count} rows from ${steps.source}`);

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
  const stepsFixed = await backfillFixationSteps(scale.id);
  if (stepsFixed.matched || stepsFixed.offGrid) {
    console.log(
      `  fixation steps   ${stepsFixed.matched} recovered from the grid` +
        (stepsFixed.offGrid
          ? `, ${stepsFixed.offGrid} left off-grid (re-fix them on screen)`
          : ""),
    );
  }

  const banking = await seedBanking();
  console.log(
    `  banking          ${banking.banks} banks · ${banking.accounts} office accounts` +
      (banking.placeholders ? ` (${banking.placeholders} improvised — confirm with the bank)` : ""),
  );

  const advicesFixed = await backfillBankAdviceOffices();
  if (advicesFixed) {
    console.log(`  bank advices     ${advicesFixed} pinned to Head Office and re-totalled`);
  }

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
  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => p.$disconnect());
