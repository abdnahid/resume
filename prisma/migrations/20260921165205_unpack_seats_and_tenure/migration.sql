-- CreateEnum
CREATE TYPE "DeskTenureKind" AS ENUM ('substantive', 'additional_charge', 'attachment');

-- DropIndex
DROP INDEX "EmployeeDesk_employeeId_orgPostId_key";

-- DropIndex
DROP INDEX "EmployeeDesk_orgPostId_idx";

-- AlterTable
-- **Add first, carry the data, drop last.** Prisma generated this as a single
-- statement that dropped `isPrimary` while `kind` defaulted to `substantive`,
-- which would have silently promoted every additional charge to a substantive
-- post. Two people hold one today (D74) and both would have been lost.
ALTER TABLE "EmployeeDesk"
ADD COLUMN     "kind" "DeskTenureKind" NOT NULL DEFAULT 'substantive',
ADD COLUMN     "releaseReason" TEXT,
ADD COLUMN     "releasedAt" TIMESTAMP(3);

UPDATE "EmployeeDesk" SET "kind" = 'additional_charge' WHERE "isPrimary" = false;

ALTER TABLE "EmployeeDesk" DROP COLUMN "isPrimary";

-- AlterTable
ALTER TABLE "OrgPost" ADD COLUMN     "seatNo" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "EmployeeDesk_orgPostId_releasedAt_idx" ON "EmployeeDesk"("orgPostId", "releasedAt");

-- CreateIndex
CREATE INDEX "EmployeeDesk_employeeId_releasedAt_idx" ON "EmployeeDesk"("employeeId", "releasedAt");
