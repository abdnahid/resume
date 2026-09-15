-- AlterTable
ALTER TABLE "TestResult" ADD COLUMN     "referralId" INTEGER;

-- CreateTable
CREATE TABLE "LabReferral" (
    "id" SERIAL NOT NULL,
    "referralNo" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "labName" TEXT NOT NULL,
    "labAddress" TEXT,
    "issuedByEmployeeId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultsInAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabReferralItem" (
    "id" SERIAL NOT NULL,
    "referralId" INTEGER NOT NULL,
    "orderItemId" INTEGER NOT NULL,

    CONSTRAINT "LabReferralItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LabReferral_referralNo_key" ON "LabReferral"("referralNo");

-- CreateIndex
CREATE INDEX "LabReferral_orderId_idx" ON "LabReferral"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "LabReferralItem_orderItemId_key" ON "LabReferralItem"("orderItemId");

-- CreateIndex
CREATE INDEX "LabReferralItem_referralId_idx" ON "LabReferralItem"("referralId");

-- CreateIndex
CREATE INDEX "TestResult_referralId_idx" ON "TestResult"("referralId");

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "LabReferral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabReferral" ADD CONSTRAINT "LabReferral_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "LabTestOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabReferral" ADD CONSTRAINT "LabReferral_issuedByEmployeeId_fkey" FOREIGN KEY ("issuedByEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabReferralItem" ADD CONSTRAINT "LabReferralItem_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "LabReferral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabReferralItem" ADD CONSTRAINT "LabReferralItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "LabTestOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
