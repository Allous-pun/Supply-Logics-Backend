-- AlterTable
ALTER TABLE "LocalSupplierScore" ADD COLUMN     "drivingTimeMin" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'Kenya',
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "region" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'Kenya',
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "region" TEXT;
