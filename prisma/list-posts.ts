import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const posts = await p.orgPost.findMany({
    select: { id: true, nameEn: true, nameBn: true, grade: true },
    orderBy: { nameEn: "asc" },
  });
  const unique = [...new Map(posts.map(p => [p.nameEn, p])).values()];
  console.log(`Total posts: ${posts.length}, Unique nameEn: ${unique.length}`);
  unique.forEach(p => console.log(`  [${p.grade ?? "—"}] ${p.nameEn}`));
}

main().catch(console.error).finally(() => p.$disconnect());
