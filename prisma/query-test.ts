import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const roots = await p.orgUnit.findMany({
    where: { parentId: null },
    select: { id: true, nameEn: true, nameBn: true, category: true },
    orderBy: { sortOrder: "asc" },
  });
  console.log("ROOTS:", JSON.stringify(roots, null, 2));

  const children = await p.orgUnit.findMany({
    where: { parentId: { not: null } },
    take: 8,
    select: { id: true, nameEn: true, category: true, parentId: true, parent: { select: { nameEn: true, category: true } } },
    orderBy: { sortOrder: "asc" },
  });
  console.log("CHILDREN:", JSON.stringify(children, null, 2));

  const offices = await p.office.findMany({ select: { id: true, nameEn: true, type: true }, orderBy: { id: "asc" } });
  console.log("OFFICES:", JSON.stringify(offices, null, 2));
}

main().catch(console.error).finally(() => p.$disconnect());
