-- CreateTable
CREATE TABLE "CO2Emission" (
    "id" TEXT NOT NULL,
    "supplier_delivery_id" TEXT,
    "branch_delivery_id" TEXT,
    "deliveryType" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "fuelType" TEXT NOT NULL,
    "co2Emitted" DOUBLE PRECISION NOT NULL,
    "calculationMethod" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CO2Emission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalSupplierScore" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "isLocal" BOOLEAN NOT NULL,
    "region" TEXT,
    "benefits" JSONB,
    "organizationId" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocalSupplierScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackagingWaste" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "materialType" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "isRecyclable" BOOLEAN NOT NULL,
    "isReusable" BOOLEAN NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackagingWaste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteReductionSuggestion" (
    "id" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "estimatedSavings" DOUBLE PRECISION NOT NULL,
    "implementationCost" DOUBLE PRECISION NOT NULL,
    "difficulty" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "implementedAt" TIMESTAMP(3),

    CONSTRAINT "WasteReductionSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CO2Emission_supplier_delivery_id_key" ON "CO2Emission"("supplier_delivery_id");

-- CreateIndex
CREATE UNIQUE INDEX "CO2Emission_branch_delivery_id_key" ON "CO2Emission"("branch_delivery_id");

-- CreateIndex
CREATE UNIQUE INDEX "LocalSupplierScore_supplierId_key" ON "LocalSupplierScore"("supplierId");

-- AddForeignKey
ALTER TABLE "CO2Emission" ADD CONSTRAINT "fk_co2_supplier_delivery" FOREIGN KEY ("supplier_delivery_id") REFERENCES "SupplierDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CO2Emission" ADD CONSTRAINT "fk_co2_branch_delivery" FOREIGN KEY ("branch_delivery_id") REFERENCES "InterBranchDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CO2Emission" ADD CONSTRAINT "CO2Emission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalSupplierScore" ADD CONSTRAINT "LocalSupplierScore_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalSupplierScore" ADD CONSTRAINT "LocalSupplierScore_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagingWaste" ADD CONSTRAINT "PackagingWaste_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagingWaste" ADD CONSTRAINT "PackagingWaste_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteReductionSuggestion" ADD CONSTRAINT "WasteReductionSuggestion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
