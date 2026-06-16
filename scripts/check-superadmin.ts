import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

(async () => {
  const supers = await prisma.user.findMany({
    where: { role: "superadmin" },
    include: { accounts: { select: { providerId: true, password: true } } },
  });

  console.log(`Found ${supers.length} superadmin user(s):\n`);
  for (const u of supers) {
    console.log({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      accounts: u.accounts.map((a) => ({
        providerId: a.providerId,
        hasPassword: !!a.password,
        pwLen: a.password?.length ?? 0,
      })),
    });
  }

  await prisma.$disconnect();
})();
