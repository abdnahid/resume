-- AlterTable
ALTER TABLE "OrgUnit" ADD COLUMN     "createdReason" TEXT,
ADD COLUMN     "isSanctioned" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "regularisedAt" TIMESTAMP(3),
ADD COLUMN     "regularisedMemoNo" TEXT;
