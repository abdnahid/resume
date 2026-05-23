import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const units = await p.orgUnit.findMany({
    include: { posts: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });

  const unitMap = new Map(units.map(u => [u.id, u]));

  function path(id: number, seen = new Set<number>()): string {
    if (seen.has(id)) return "?";
    seen.add(id);
    const u = unitMap.get(id);
    if (!u) return "?";
    if (!u.parentId) return u.nameEn;
    return path(u.parentId, seen) + " > " + u.nameEn;
  }

  // Print all unique posts grouped by their full path
  const rows: { path: string; nameEn: string; grade: string | null }[] = [];
  for (const unit of units) {
    for (const post of unit.posts) {
      rows.push({ path: path(unit.id), nameEn: post.nameEn, grade: post.grade });
    }
  }
  // Deduplicate by nameEn + path combo for readability; show unique nameEn with sample path
  const seen = new Set<string>();
  for (const r of rows) {
    if (!seen.has(r.nameEn)) {
      seen.add(r.nameEn);
      console.log(`[${r.grade ?? "—"}]  ${r.nameEn.padEnd(55)} ${r.path}`);
    }
  }
}

main().catch(console.error).finally(() => p.$disconnect());
