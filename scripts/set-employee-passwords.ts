import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashed = await hashPassword("zxcvbnm0");

  const employeeUsers = await prisma.user.findMany({
    where: { role: "employee" },
    select: { id: true, username: true },
  });

  console.log(`Found ${employeeUsers.length} employee accounts to update.`);

  let updated = 0;
  for (const user of employeeUsers) {
    const result = await prisma.account.updateMany({
      where: { userId: user.id, providerId: "credential" },
      data: { password: hashed },
    });
    if (result.count > 0) updated++;
  }

  console.log(`Updated passwords for ${updated} employees → "zxcvbnm0"`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
