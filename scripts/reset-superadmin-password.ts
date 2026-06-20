import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SUPERADMIN_ID = process.env.SUPER_ADMIN_ID ?? "20220010021";
const NEW_PASSWORD = "bsti@123";

async function main() {
  const hashed = await hashPassword(NEW_PASSWORD);

  const result = await prisma.account.updateMany({
    where: {
      accountId: SUPERADMIN_ID,
      providerId: "credential",
    },
    data: { password: hashed },
  });

  if (result.count === 0) {
    console.error(`No account found for employee ID: ${SUPERADMIN_ID}`);
    process.exit(1);
  }

  console.log(`Password reset to "${NEW_PASSWORD}" for superadmin (${SUPERADMIN_ID})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
