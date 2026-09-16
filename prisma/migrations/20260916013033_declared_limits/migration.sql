-- CreateTable
CREATE TABLE "ApplicationDeclaredLimit" (
    "id" SERIAL NOT NULL,
    "applicationSubProductId" INTEGER NOT NULL,
    "parameterId" INTEGER NOT NULL,
    "subParameterId" INTEGER,
    "declaredValue" TEXT NOT NULL,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "declaredByEmployeeId" TEXT,
    "note" TEXT,

    CONSTRAINT "ApplicationDeclaredLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationDeclaredLimit_parameterId_idx" ON "ApplicationDeclaredLimit"("parameterId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDeclaredLimit_applicationSubProductId_parameterI_key" ON "ApplicationDeclaredLimit"("applicationSubProductId", "parameterId", "subParameterId");

-- AddForeignKey
ALTER TABLE "ApplicationDeclaredLimit" ADD CONSTRAINT "ApplicationDeclaredLimit_applicationSubProductId_fkey" FOREIGN KEY ("applicationSubProductId") REFERENCES "ApplicationSubProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDeclaredLimit" ADD CONSTRAINT "ApplicationDeclaredLimit_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "TestParameter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDeclaredLimit" ADD CONSTRAINT "ApplicationDeclaredLimit_subParameterId_fkey" FOREIGN KEY ("subParameterId") REFERENCES "TestSubParameter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDeclaredLimit" ADD CONSTRAINT "ApplicationDeclaredLimit_declaredByEmployeeId_fkey" FOREIGN KEY ("declaredByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
