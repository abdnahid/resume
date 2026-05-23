import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import XLSX from "xlsx";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ── Excel row shape ───────────────────────────────────────────────────────────
interface ExcelRow {
  office?: string;
  id?: number;
  name_bn?: string;
  present_designation?: string;
  dob_parmanent?: number;
  grade?: number;
  name_en?: string;
  wing?: string;
  phone?: number;
  acc?: number;
  branch?: string;
}

// ── Office name (Excel) → DB office ID ───────────────────────────────────────
// Keys stored in NFC form; Excel values are also normalised before lookup.
// Bengali "য়" can be U+09DF or U+09AF+U+09BC depending on source — NFC unifies them.
const OFFICE_ID_RAW: Record<string, number> = {
  "প্রধান কার্যালয়": 6,
  "চট্টগ্রাম": 3,
  "রাজশাহী": 22,
  "খুলনা": 18,
  "বরিশাল": 1,
  "সিলেট": 2,
  "রংপুর": 4,
  "ময়মনসিংহ": 5,
  "ডিএমআই": 19,
  "কুমিল্লা": 7,
  "ফরিদপুর": 8,
  "কক্সবাজার": 9,
  "কুষ্টিয়া": 10,
  "গাজীপুর": 12,
  "পটুয়াখালী": 13,
  "পাবনা": 14,
  "গোপালগঞ্জ": 15,
  "দিনাজপুর": 16,
  "নোয়াখালী": 17,
  "নরসিংদী": 20,
  "যশোর": 21,
  "নারায়ণগঞ্জ": 23,
};
const OFFICE_ID: Record<string, number> = Object.fromEntries(
  Object.entries(OFFICE_ID_RAW).map(([k, v]) => [k.normalize("NFC"), v])
);
function lookupOfficeId(name: string | undefined): number | undefined {
  if (!name) return undefined;
  return OFFICE_ID[name.normalize("NFC")];
}

// ── DB office ID → root OrgUnit ID (0 = head office, handled separately) ────
const OFFICE_ORG_ROOT: Record<number, number> = {
  3: 240,   // Chittagong divisional
  22: 247,  // Rajshahi divisional
  18: 254,  // Khulna divisional
  2: 261,   // Sylhet divisional
  1: 267,   // Barisal divisional
  4: 274,   // Rangpur divisional
  5: 281,   // Mymensingh divisional
  19: 239,  // DMI
  7: 294,   // Cumilla regional
  8: 313,   // Faridpur regional
  9: 300,   // Cox's Bazar regional
  10: 340,  // Kushtia regional
  12: 319,  // Gazipur regional
  13: 375,  // Patuakhali regional
  14: 368,  // Pabna regional
  15: 326,  // Gopalganj regional
  16: 306,  // Dinajpur regional
  17: 361,  // Noakhali regional
  20: 354,  // Narsingdi regional
  21: 333,  // Jessore regional
  23: 347,  // Narayanganj regional
};

// ── Head office: wing keyword → wing root OrgUnit ID ─────────────────────────
const HEAD_WING_ROOT: Record<string, number> = {
  "প্রশাসন": 193,
  "মান":      203,
  "সিএম":     212,
  "পদার্থ":   217,
  "রসায়ন":   223,
  "মেট্রোলজি": 229,
  "এমএসসি":  236,
};
const DG_OFFICE_UNIT = 192; // fallback for head office with no wing

// ── Grade mapping: Excel grade → DB grade string ──────────────────────────────
function mapGrade(g: number | undefined): string {
  if (!g) return "20";
  const map: Record<number, string> = {
    4: "5", 5: "5", 7: "6", 8: "9", 10: "11", 11: "11", 12: "13", 15: "16",
  };
  return map[g] ?? String(g);
}

// ── Excel serial date → YYYY-MM-DD ────────────────────────────────────────────
function excelDateToISO(serial: number | undefined): string {
  if (!serial || serial < 1) return "1980-01-01";
  try {
    const d = new Date(Date.UTC(1900, 0, 1) + (serial - 2) * 86400000);
    const iso = d.toISOString().slice(0, 10);
    return iso < "1930-01-01" || iso > "2010-01-01" ? "1980-01-01" : iso;
  } catch {
    return "1980-01-01";
  }
}

// ── Walk subtree: collect all unit IDs under a root ───────────────────────────
function subtreeIds(rootId: number, children: Map<number, number[]>): number[] {
  const ids = [rootId];
  for (const cid of (children.get(rootId) ?? [])) ids.push(...subtreeIds(cid, children));
  return ids;
}

// ── Find child unit whose Bengali name contains the keyword ───────────────────
function findChildByKeyword(
  parentId: number,
  keyword: string,
  children: Map<number, number[]>,
  units: Map<number, { nameBn: string }>,
): number | null {
  for (const cid of (children.get(parentId) ?? [])) {
    if (units.get(cid)?.nameBn.includes(keyword)) return cid;
  }
  return null;
}

// ── Pick best OrgPost for target grade from given unit IDs ────────────────────
type Post = { id: number; grade: string | null; nameBn: string };
function bestPost(unitIds: number[], targetGrade: string, posts: Map<number, Post[]>): Post | null {
  const target = parseInt(targetGrade);
  let best: Post | null = null;
  let bestDiff = Infinity;
  for (const uid of unitIds) {
    for (const p of (posts.get(uid) ?? [])) {
      if (!p.grade) continue;
      const diff = Math.abs(parseInt(p.grade) - target);
      if (diff < bestDiff) { best = p; bestDiff = diff; }
    }
  }
  return best;
}

// ── Main post-finder ──────────────────────────────────────────────────────────
function findOrgPost(
  officeId: number,
  wing: string | undefined,
  mappedGrade: string,
  units: Map<number, { nameBn: string }>,
  children: Map<number, number[]>,
  posts: Map<number, Post[]>,
): Post | null {
  if (officeId === 6) {
    // Head office: use wing subtree
    const wingRoot = (wing && HEAD_WING_ROOT[wing]) ?? DG_OFFICE_UNIT;
    return bestPost(subtreeIds(wingRoot, children), mappedGrade, posts);
  }

  const orgRoot = OFFICE_ORG_ROOT[officeId];
  if (!orgRoot) return null;

  // Try to find a section matching the wing keyword
  if (wing) {
    const sectionId = findChildByKeyword(orgRoot, wing, children, units);
    if (sectionId) return bestPost([sectionId], mappedGrade, posts);
  }

  // Fallback: any post in the whole office subtree
  return bestPost(subtreeIds(orgRoot, children), mappedGrade, posts);
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Excel Employee Seeder ===\n");

  // Load existing employee IDs to skip duplicates
  const existing = new Set((await prisma.employee.findMany({ select: { id: true } })).map(e => e.id));
  console.log(`Existing employees in DB: ${existing.size}`);

  // Load organogram into memory
  const units = new Map<number, { nameBn: string }>();
  const unitChildren = new Map<number, number[]>();
  const unitPosts = new Map<number, Post[]>();

  for (const u of await prisma.orgUnit.findMany()) {
    units.set(u.id, { nameBn: u.nameBn });
    if (u.parentId) {
      const arr = unitChildren.get(u.parentId) ?? [];
      arr.push(u.id);
      unitChildren.set(u.parentId, arr);
    }
  }
  for (const p of await prisma.orgPost.findMany({ where: { isActive: true } })) {
    const arr = unitPosts.get(p.unitId) ?? [];
    arr.push({ id: p.id, grade: p.grade, nameBn: p.nameBn });
    unitPosts.set(p.unitId, arr);
  }
  console.log(`Loaded ${units.size} org units and ${[...unitPosts.values()].reduce((s,a)=>s+a.length,0)} org posts\n`);

  // Load Excel
  const wb = XLSX.readFile("utils/employees.xlsx");
  const rows = (XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as ExcelRow[])
    .filter(r => r.id && r.office && lookupOfficeId(r.office));

  // Group by office
  const byOffice = new Map<string, ExcelRow[]>();
  for (const r of rows) {
    const arr = byOffice.get(r.office!) ?? [];
    arr.push(r);
    byOffice.set(r.office!, arr);
  }

  // Select employees per office
  const selected: ExcelRow[] = [];
  for (const [office, officeRows] of byOffice) {
    // Sort: lowest grade number = highest rank first
    const sorted = [...officeRows].sort((a, b) => (a.grade ?? 99) - (b.grade ?? 99));

    if (lookupOfficeId(office) === 6) {
      // Head office: up to 10 per wing to cover all sections (target ≥50 total)
      const byWing = new Map<string, ExcelRow[]>();
      for (const r of sorted) {
        const w = r.wing ?? "__none__";
        const arr = byWing.get(w) ?? [];
        arr.push(r);
        byWing.set(w, arr);
      }
      for (const wingRows of byWing.values()) selected.push(...wingRows.slice(0, 10));
    } else {
      // All other offices: take all (they all meet ≥10/≥5 minimums)
      selected.push(...sorted);
    }
  }

  console.log(`Selected ${selected.length} employees to seed (excl. বগুড়া — no Office record)\n`);

  const password = await hashPassword("bsti@123");
  const now = new Date();
  const defaultJoinedAt = "2020-01-01";

  // Track who becomes office admin (best candidate = lowest grade number per office)
  const adminCandidate = new Map<number, string>(); // officeId → empId

  let created = 0, skipped = 0, failed = 0;

  for (const row of selected) {
    const empId = String(Math.floor(row.id!));
    if (existing.has(empId)) { skipped++; continue; }

    const officeId = lookupOfficeId(row.office)!;
    const mappedGrade = mapGrade(row.grade);
    const orgPost = findOrgPost(officeId, row.wing, mappedGrade, units, unitChildren, unitPosts);

    const userId = `user_${empId}`;
    const email = `${empId}@bsti.gov.bd`;
    const dob = excelDateToISO(row.dob_parmanent);

    try {
      await prisma.user.create({
        data: {
          id: userId,
          name: row.name_bn ?? row.name_en ?? "Unknown",
          email,
          emailVerified: false,
          username: empId,
          role: "employee",
          createdAt: now,
          updatedAt: now,
        },
      });

      await prisma.account.create({
        data: {
          id: `acc_${empId}`,
          accountId: empId,
          providerId: "credential",
          userId,
          password,
          createdAt: now,
          updatedAt: now,
        },
      });

      await prisma.employee.create({
        data: {
          id: empId,
          nameEn: (row.name_en ?? row.name_bn ?? "Unknown").trim(),
          nameBn: (row.name_bn ?? row.name_en ?? "Unknown").trim(),
          fatherNameEn: "N/A",
          fatherNameBn: "তথ্য নেই",
          motherNameEn: "N/A",
          motherNameBn: "তথ্য নেই",
          dateOfBirth: dob,
          gender: "male",
          maritalStatus: "married",
          designationBn: row.present_designation?.trim() ?? null,
          grade: mappedGrade,
          wing: row.wing?.trim() ?? null,
          officeId,
          orgPostId: orgPost?.id ?? null,
          userId,
          bankAccountNo: row.acc ? String(Math.floor(row.acc)) : null,
          phone: row.phone ? String(row.phone) : null,
        },
      });

      await prisma.posting.create({
        data: {
          employeeId: empId,
          officeId,
          orgPostId: orgPost?.id ?? null,
          grade: mappedGrade,
          type: "initial",
          status: "active",
          joinedAt: defaultJoinedAt,
        },
      });

      // Track admin candidate (prefer lower grade number = higher rank)
      const curCandidate = adminCandidate.get(officeId);
      if (!curCandidate) {
        adminCandidate.set(officeId, empId);
      } else {
        const curGrade = parseInt(mappedGrade);
        const existGrade = parseInt(mapGrade(
          selected.find(r => String(Math.floor(r.id!)) === curCandidate)?.grade
        ));
        if (curGrade < existGrade) adminCandidate.set(officeId, empId);
      }

      created++;
      if (created % 50 === 0) console.log(`  ...${created} employees created`);
    } catch (err) {
      console.error(`  FAIL: ${empId} — ${(err as Error).message.split("\n")[0]}`);
      failed++;
    }
  }

  // Promote admin candidates to officeadmin role
  console.log("\nSetting office admins...");
  for (const [officeId, empId] of adminCandidate) {
    const emp = selected.find(r => String(Math.floor(r.id!)) === empId);
    try {
      await prisma.user.update({
        where: { username: empId },
        data: { role: "officeadmin" },
      });
      console.log(`  Office ${officeId}: ${emp?.name_bn ?? empId} → officeadmin`);
    } catch {
      console.warn(`  Could not set admin for office ${officeId}`);
    }
  }

  console.log(`\n✓ Done — ${created} created, ${skipped} skipped, ${failed} failed`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
