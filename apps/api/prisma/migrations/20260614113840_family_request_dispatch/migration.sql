-- CreateEnum
CREATE TYPE "WorkOrderSource" AS ENUM ('MANUAL', 'RISK_DISPATCH', 'FAMILY_REQUEST', 'SOS');

-- AlterTable
ALTER TABLE "CheckIn" ADD COLUMN     "requestText" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'FAMILY';

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "familyRequestText" TEXT,
ADD COLUMN     "sourceFrom" "WorkOrderSource" NOT NULL DEFAULT 'MANUAL';
