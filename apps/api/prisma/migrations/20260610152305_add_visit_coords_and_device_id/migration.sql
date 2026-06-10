/*
  Warnings:

  - Added the required column `deviceId` to the `DeviceData` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DeviceData" ADD COLUMN     "deviceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "VisitRecord" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;
