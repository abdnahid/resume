import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import "dotenv/config";

const USERNAME = "20220010021";
const NEW_PASSWORD = "bsti@123";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

(async () => {
  const user = await prisma.user.findUnique({ where: { username: USERNAME } });
  if (!user) {
    console.error(`No user with username ${USERNAME}`);
    process.exit(1);
  }

  const hash = await hashPassword(NEW_PASSWORD);

  const updated = await prisma.account.updateMany({
    where: { userId: user.id, providerId: "credential" },
    data: { password: hash, updatedAt: new Date() },
  });

  console.log(
    `Reset password for ${USERNAME} (role=${user.role}). Rows updated: ${updated.count}`
  );
  console.log(`Username: ${USERNAME}`);
  console.log(`Password: ${NEW_PASSWORD}`);

  await prisma.$disconnect();
})();
