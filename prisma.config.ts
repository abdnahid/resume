// Prisma CLI configuration. The app's own connection is made in `lib/prisma.ts`.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Deliberately no `seed`. It pointed at `prisma/seed.ts`, the superseded
    // demo seed that writes a relation the schema no longer has — so
    // `prisma migrate reset` would have failed at the end, after dropping
    // everything. The real seeds are the `npm run seed:*` and `import:*`
    // scripts, run deliberately and one at a time.
  },
  datasource: {
    /**
     * **The direct endpoint, not the pooled one.**
     *
     * `DATABASE_URL` is Neon's `-pooler` host, which is right for the app and
     * wrong for DDL: migrations take advisory locks and run multi-statement
     * batches, and a transaction pooler does not hold a session across them.
     * Falls back to `DATABASE_URL` so a machine that has not set the direct
     * one still works — on a database with no pooler they are the same string.
     */
    url: process.env["DIRECT_DATABASE_URL"] ?? process.env["DATABASE_URL"],
  },
});
