-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "designationIsInferred" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "designationTitleId" INTEGER;

-- AlterTable
ALTER TABLE "OrgPost" ADD COLUMN     "titleId" INTEGER;

-- CreateTable
CREATE TABLE "JobTitle" (
    "id" SERIAL NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleBn" TEXT,
    "titleKey" TEXT NOT NULL,
    "rankLabel" TEXT NOT NULL,
    "rankOrder" INTEGER NOT NULL DEFAULT 800,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobTitle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobTitle_titleKey_key" ON "JobTitle"("titleKey");

-- CreateIndex
CREATE INDEX "JobTitle_rankOrder_idx" ON "JobTitle"("rankOrder");

-- AddForeignKey
ALTER TABLE "OrgPost" ADD CONSTRAINT "OrgPost_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "JobTitle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_designationTitleId_fkey" FOREIGN KEY ("designationTitleId") REFERENCES "JobTitle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
