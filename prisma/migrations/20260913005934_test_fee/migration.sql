-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "testFeePaymentId" INTEGER,
ADD COLUMN     "testFeePoisha" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Application_testFeePaymentId_key" ON "Application"("testFeePaymentId");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_testFeePaymentId_fkey" FOREIGN KEY ("testFeePaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
