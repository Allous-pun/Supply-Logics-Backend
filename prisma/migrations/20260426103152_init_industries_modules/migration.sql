/*
  Warnings:

  - You are about to drop the column `code` on the `Industry` table. All the data in the column will be lost.
  - You are about to drop the column `code` on the `Module` table. All the data in the column will be lost.
  - You are about to drop the column `parentId` on the `Module` table. All the data in the column will be lost.
  - You are about to drop the column `address` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `logo` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `allowMultipleSessions` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `allowSelfRegistration` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `businessHours` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `currencyPosition` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `dataRetentionDays` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `decimalPlaces` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `decimalSeparator` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `emailFooter` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `enableAuditLog` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `enableEmailNotifications` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `enableSmsNotifications` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `faviconUrl` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceNumberStart` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `invoicePrefix` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `lockoutDurationMinutes` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `logoUrl` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `maxLoginAttempts` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `minPasswordLength` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `passwordExpiryDays` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `primaryColor` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `requireEmailVerification` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `requireLowercase` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `requireNumbers` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `requireSpecialChars` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `requireUppercase` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `secondaryColor` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `sessionTimeoutMinutes` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `smsSenderId` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `taxName` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `taxRate` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `thousandSeparator` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `timeFormat` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `twoFactorRequired` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `weekStartDay` on the `OrganizationSettings` table. All the data in the column will be lost.
  - You are about to drop the `OrganizationRolePermission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Permission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Role` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserRoleAssignment` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[key]` on the table `Industry` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[key]` on the table `Module` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `key` to the `Industry` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Industry` table without a default value. This is not possible if the table is not empty.
  - Made the column `color` on table `Industry` required. This step will fail if there are existing NULL values in that column.
  - Made the column `icon` on table `Industry` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `key` to the `Module` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Module` table without a default value. This is not possible if the table is not empty.
  - Made the column `color` on table `Module` required. This step will fail if there are existing NULL values in that column.
  - Made the column `icon` on table `Module` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'STAFF');

-- DropForeignKey
ALTER TABLE "Module" DROP CONSTRAINT "Module_parentId_fkey";

-- DropForeignKey
ALTER TABLE "OrganizationRolePermission" DROP CONSTRAINT "OrganizationRolePermission_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "OrganizationRolePermission" DROP CONSTRAINT "OrganizationRolePermission_permissionId_fkey";

-- DropForeignKey
ALTER TABLE "OrganizationRolePermission" DROP CONSTRAINT "OrganizationRolePermission_roleId_fkey";

-- DropForeignKey
ALTER TABLE "Permission" DROP CONSTRAINT "Permission_roleId_fkey";

-- DropForeignKey
ALTER TABLE "Role" DROP CONSTRAINT "Role_industryId_fkey";

-- DropForeignKey
ALTER TABLE "UserRoleAssignment" DROP CONSTRAINT "UserRoleAssignment_moduleId_fkey";

-- DropForeignKey
ALTER TABLE "UserRoleAssignment" DROP CONSTRAINT "UserRoleAssignment_roleId_fkey";

-- DropForeignKey
ALTER TABLE "UserRoleAssignment" DROP CONSTRAINT "UserRoleAssignment_userId_fkey";

-- DropIndex
DROP INDEX "Industry_code_key";

-- DropIndex
DROP INDEX "Module_code_key";

-- AlterTable
ALTER TABLE "Industry" DROP COLUMN "code",
ADD COLUMN     "key" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "color" SET NOT NULL,
ALTER COLUMN "icon" SET NOT NULL;

-- AlterTable
ALTER TABLE "Module" DROP COLUMN "code",
DROP COLUMN "parentId",
ADD COLUMN     "isCore" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "key" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "color" SET NOT NULL,
ALTER COLUMN "icon" SET NOT NULL;

-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "address",
DROP COLUMN "logo";

-- AlterTable
ALTER TABLE "OrganizationSettings" DROP COLUMN "allowMultipleSessions",
DROP COLUMN "allowSelfRegistration",
DROP COLUMN "businessHours",
DROP COLUMN "currencyPosition",
DROP COLUMN "dataRetentionDays",
DROP COLUMN "decimalPlaces",
DROP COLUMN "decimalSeparator",
DROP COLUMN "emailFooter",
DROP COLUMN "enableAuditLog",
DROP COLUMN "enableEmailNotifications",
DROP COLUMN "enableSmsNotifications",
DROP COLUMN "faviconUrl",
DROP COLUMN "invoiceNumberStart",
DROP COLUMN "invoicePrefix",
DROP COLUMN "lockoutDurationMinutes",
DROP COLUMN "logoUrl",
DROP COLUMN "maxLoginAttempts",
DROP COLUMN "minPasswordLength",
DROP COLUMN "passwordExpiryDays",
DROP COLUMN "primaryColor",
DROP COLUMN "requireEmailVerification",
DROP COLUMN "requireLowercase",
DROP COLUMN "requireNumbers",
DROP COLUMN "requireSpecialChars",
DROP COLUMN "requireUppercase",
DROP COLUMN "secondaryColor",
DROP COLUMN "sessionTimeoutMinutes",
DROP COLUMN "smsSenderId",
DROP COLUMN "taxName",
DROP COLUMN "taxRate",
DROP COLUMN "thousandSeparator",
DROP COLUMN "timeFormat",
DROP COLUMN "twoFactorRequired",
DROP COLUMN "weekStartDay";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'STAFF';

-- DropTable
DROP TABLE "OrganizationRolePermission";

-- DropTable
DROP TABLE "Permission";

-- DropTable
DROP TABLE "Role";

-- DropTable
DROP TABLE "UserRoleAssignment";

-- DropEnum
DROP TYPE "CurrencyPosition";

-- DropEnum
DROP TYPE "WeekStartDay";

-- CreateIndex
CREATE UNIQUE INDEX "Industry_key_key" ON "Industry"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Module_key_key" ON "Module"("key");
