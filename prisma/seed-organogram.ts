import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import {
  WINGS,
  DIVISIONAL_OFFICES,
  REGIONAL_OFFICES,
  type OrgEntry,
} from "../app/(main)/organogram/_components/data";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type Cat = "wing" | "divisional" | "regional" | "unit";

async function seedUnit(
  entry: OrgEntry,
  category: Cat,
  parentId: number | null,
  sortOrder: number,
): Promise<void> {
  const unit = await prisma.orgUnit.create({
    data: {
      slug: entry.id,
      nameEn: entry.nameEn,
      nameBn: entry.nameBn,
      category,
      parentId: parentId ?? undefined,
      sortOrder,
    },
  });

  if (entry.posts?.length) {
    await prisma.orgPost.createMany({
      data: entry.posts.map((p, i) => ({
        nameEn: p.nameEn,
        nameBn: p.nameBn,
        sanctionedCount: p.count,
        sortOrder: i,
        unitId: unit.id,
      })),
    });
  }

  if (entry.children?.length) {
    for (let i = 0; i < entry.children.length; i++) {
      await seedUnit(entry.children[i], "unit", unit.id, i);
    }
  }
}

async function main() {
  console.log("Clearing existing organogram data…");
  await prisma.$executeRaw`DELETE FROM "OrgPost"`;
  await prisma.$executeRaw`DELETE FROM "OrgUnit"`;

  console.log("Seeding Head Office wings…");
  for (let i = 0; i < WINGS.length; i++) {
    await seedUnit(WINGS[i], "wing", null, i);
  }

  console.log("Seeding Divisional Offices…");
  for (let i = 0; i < DIVISIONAL_OFFICES.length; i++) {
    await seedUnit(DIVISIONAL_OFFICES[i], "divisional", null, i);
  }

  console.log("Seeding Regional Offices…");
  for (let i = 0; i < REGIONAL_OFFICES.length; i++) {
    await seedUnit(REGIONAL_OFFICES[i], "regional", null, i);
  }

  const unitCount = await prisma.orgUnit.count();
  const postCount = await prisma.orgPost.count();
  console.log(`✓ Done — ${unitCount} units, ${postCount} posts`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
