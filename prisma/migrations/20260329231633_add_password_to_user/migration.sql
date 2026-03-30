/*
  Warnings:

  - Added the required column `password` to the `UserProfile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "password" TEXT NOT NULL;
