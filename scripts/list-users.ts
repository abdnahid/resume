import { prisma } from "../lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    where: { role: { in: ["officeadmin", "superadmin"] } },
    select: { id: true, username: true, role: true, name: true },
    orderBy: { role: "asc" },
  });
  console.log(JSON.stringify(users, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
