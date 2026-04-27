/*
  Warnings:

  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[orgCode]` on the table `Organization` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `orgCode` to the `Organization` table without a default value. This is not possible if the table is not empty.
  - Added the required column `loginCode` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orgCode` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'STAFF');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "orgCode" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "password",
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "loginCode" TEXT NOT NULL,
ADD COLUMN     "orgCode" TEXT NOT NULL,
DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'STAFF';

-- DropEnum
DROP TYPE "Role";

-- CreateIndex
CREATE UNIQUE INDEX "Organization_orgCode_key" ON "Organization"("orgCode");
