/*
  Warnings:

  - You are about to drop the column `defaultRole` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "defaultRole";

-- DropEnum
DROP TYPE "UserRoleEnum";
