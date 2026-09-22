-- AlterTable
ALTER TABLE "OrgPost" ADD COLUMN     "createdByEmployeeId" TEXT,
ADD COLUMN     "createdReason" TEXT,
ADD COLUMN     "isSanctioned" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "regularisedAt" TIMESTAMP(3),
ADD COLUMN     "regularisedMemoNo" TEXT;

-- AddForeignKey
ALTER TABLE "OrgPost" ADD CONSTRAINT "OrgPost_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
