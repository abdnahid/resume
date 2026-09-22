-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_designationTitleId_fkey";

-- DropForeignKey
ALTER TABLE "OrgPost" DROP CONSTRAINT "OrgPost_titleId_fkey";

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "designationTitleId",
ADD COLUMN     "designationId" INTEGER;

-- AlterTable
ALTER TABLE "OrgPost" DROP COLUMN "titleId";

-- DropTable
DROP TABLE "JobTitle";

-- CreateTable
CREATE TABLE "Designation" (
    "id" SERIAL NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleBn" TEXT,
    "titleKey" TEXT NOT NULL,
    "rankLabel" TEXT NOT NULL,
    "rankOrder" INTEGER NOT NULL DEFAULT 800,
    "isOfficer" BOOLEAN NOT NULL DEFAULT false,
    "wing" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Designation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDesk" (
    "id" SERIAL NOT NULL,
    "employeeId" TEXT NOT NULL,
    "orgPostId" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeDesk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Designation_titleKey_key" ON "Designation"("titleKey");

-- CreateIndex
CREATE INDEX "Designation_rankOrder_idx" ON "Designation"("rankOrder");

-- CreateIndex
CREATE INDEX "Designation_wing_idx" ON "Designation"("wing");

-- CreateIndex
CREATE INDEX "EmployeeDesk_orgPostId_idx" ON "EmployeeDesk"("orgPostId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeDesk_employeeId_orgPostId_key" ON "EmployeeDesk"("employeeId", "orgPostId");

-- AddForeignKey
ALTER TABLE "EmployeeDesk" ADD CONSTRAINT "EmployeeDesk_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDesk" ADD CONSTRAINT "EmployeeDesk_orgPostId_fkey" FOREIGN KEY ("orgPostId") REFERENCES "OrgPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
