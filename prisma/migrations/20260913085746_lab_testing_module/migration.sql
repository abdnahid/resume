-- CreateEnum
CREATE TYPE "LabRung" AS ENUM ('wing_head', 'deputy_director', 'assistant_director', 'examiner');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApplicationState" ADD VALUE 'lab_testing';
ALTER TYPE "ApplicationState" ADD VALUE 'lab_test_passed';
ALTER TYPE "ApplicationState" ADD VALUE 'lab_test_failed';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LabTestOrderState" ADD VALUE 'received';
ALTER TYPE "LabTestOrderState" ADD VALUE 'pending_check';
ALTER TYPE "LabTestOrderState" ADD VALUE 'pending_authorisation';
ALTER TYPE "LabTestOrderState" ADD VALUE 'pending_approval';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'wing_head';
ALTER TYPE "Role" ADD VALUE 'testing_officer';

-- AlterTable
ALTER TABLE "LabTestOrder" ADD COLUMN     "holderRung" "LabRung",
ADD COLUMN     "receivedByWingAt" TIMESTAMP(3),
ADD COLUMN     "receivedByWingEmployeeId" TEXT;

-- CreateTable
CREATE TABLE "LabTestOrderMovement" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "fromEmployeeId" TEXT,
    "toEmployeeId" TEXT NOT NULL,
    "direction" "MovementDirection" NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabTestOrderMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabTestReport" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "reportNo" TEXT,
    "verdict" "TestVerdict" NOT NULL DEFAULT 'not_tested',
    "remarks" TEXT,
    "testedByEmployeeId" TEXT,
    "testedAt" TIMESTAMP(3),
    "checkedByEmployeeId" TEXT,
    "checkedAt" TIMESTAMP(3),
    "authorisedByEmployeeId" TEXT,
    "authorisedAt" TIMESTAMP(3),
    "approvedByEmployeeId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "returnedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabTestReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LabTestOrderMovement_orderId_idx" ON "LabTestOrderMovement"("orderId");

-- CreateIndex
CREATE INDEX "LabTestOrderMovement_toEmployeeId_idx" ON "LabTestOrderMovement"("toEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "LabTestReport_orderId_key" ON "LabTestReport"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "LabTestReport_reportNo_key" ON "LabTestReport"("reportNo");

-- AddForeignKey
ALTER TABLE "LabTestOrder" ADD CONSTRAINT "LabTestOrder_receivedByWingEmployeeId_fkey" FOREIGN KEY ("receivedByWingEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestOrderMovement" ADD CONSTRAINT "LabTestOrderMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "LabTestOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestOrderMovement" ADD CONSTRAINT "LabTestOrderMovement_fromEmployeeId_fkey" FOREIGN KEY ("fromEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestOrderMovement" ADD CONSTRAINT "LabTestOrderMovement_toEmployeeId_fkey" FOREIGN KEY ("toEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestOrderMovement" ADD CONSTRAINT "LabTestOrderMovement_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestReport" ADD CONSTRAINT "LabTestReport_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "LabTestOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestReport" ADD CONSTRAINT "LabTestReport_testedByEmployeeId_fkey" FOREIGN KEY ("testedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestReport" ADD CONSTRAINT "LabTestReport_checkedByEmployeeId_fkey" FOREIGN KEY ("checkedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestReport" ADD CONSTRAINT "LabTestReport_authorisedByEmployeeId_fkey" FOREIGN KEY ("authorisedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestReport" ADD CONSTRAINT "LabTestReport_approvedByEmployeeId_fkey" FOREIGN KEY ("approvedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
