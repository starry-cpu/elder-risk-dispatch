-- CreateEnum
CREATE TYPE "Role" AS ENUM ('GRID_WORKER', 'COMMUNITY_DOCTOR', 'PROPERTY', 'VOLUNTEER', 'ADMIN', 'FAMILY');

-- CreateEnum
CREATE TYPE "DutyStatus" AS ENUM ('ON_DUTY', 'OFF_DUTY');

-- CreateEnum
CREATE TYPE "ServiceLevel" AS ENUM ('NORMAL', 'KEY', 'HIGH');

-- CreateEnum
CREATE TYPE "CheckInMethod" AS ENUM ('ONE_TAP', 'VOICE', 'TEXT', 'PROXY');

-- CreateEnum
CREATE TYPE "CheckInStatus" AS ENUM ('NORMAL', 'ABNORMAL', 'MISSED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RiskSource" AS ENUM ('MISSED_CHECKIN', 'ABNORMAL_TEXT', 'DEVICE', 'HISTORY', 'MANUAL');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('PENDING_REVIEW', 'CONFIRMED', 'IGNORED', 'DISPATCHED');

-- CreateEnum
CREATE TYPE "WorkOrderType" AS ENUM ('HEALTH', 'LIFE', 'REPAIR', 'ESCORT', 'COMPANION', 'ERRAND');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "openid" TEXT,
    "unionid" TEXT,
    "phone" TEXT,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "passwordHash" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "district" TEXT,
    "dutyStatus" "DutyStatus" NOT NULL DEFAULT 'OFF_DUTY',
    "avgResponseMin" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Elder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "birthDate" TIMESTAMP(3),
    "idCard" TEXT,
    "address" TEXT,
    "district" TEXT NOT NULL,
    "longitude" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "healthTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "serviceLevel" "ServiceLevel" NOT NULL DEFAULT 'NORMAL',
    "livingStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Elder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" TEXT NOT NULL,
    "elderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElderFamilyLink" (
    "id" TEXT NOT NULL,
    "elderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,

    CONSTRAINT "ElderFamilyLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "elderId" TEXT NOT NULL,
    "method" "CheckInMethod" NOT NULL,
    "content" TEXT,
    "voiceUrl" TEXT,
    "status" "CheckInStatus" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitRecord" (
    "id" TEXT NOT NULL,
    "elderId" TEXT NOT NULL,
    "gridWorkerId" TEXT NOT NULL,
    "visitTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observation" TEXT NOT NULL,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,

    CONSTRAINT "VisitRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceData" (
    "id" TEXT NOT NULL,
    "elderId" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "value" TEXT,
    "alarm" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskEvent" (
    "id" TEXT NOT NULL,
    "elderId" TEXT NOT NULL,
    "level" "RiskLevel" NOT NULL,
    "source" "RiskSource" NOT NULL,
    "score" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RiskStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedBy" TEXT,
    "ruleVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "riskEventId" TEXT,
    "elderId" TEXT NOT NULL,
    "type" "WorkOrderType" NOT NULL,
    "level" "RiskLevel" NOT NULL,
    "assigneeId" TEXT,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'PENDING',
    "deadline" TIMESTAMP(3),
    "dispatchReason" TEXT,
    "result" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderTimeline" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "operatorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceEvaluation" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "condition" JSONB NOT NULL,
    "weight" INTEGER NOT NULL,
    "level" "RiskLevel" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiInferenceLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "humanCorrection" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInferenceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "detail" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "templateId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_openid_key" ON "User"("openid");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "EmergencyContact_elderId_idx" ON "EmergencyContact"("elderId");

-- CreateIndex
CREATE UNIQUE INDEX "ElderFamilyLink_elderId_userId_key" ON "ElderFamilyLink"("elderId", "userId");

-- CreateIndex
CREATE INDEX "CheckIn_elderId_createdAt_idx" ON "CheckIn"("elderId", "createdAt");

-- CreateIndex
CREATE INDEX "DeviceData_elderId_timestamp_idx" ON "DeviceData"("elderId", "timestamp");

-- CreateIndex
CREATE INDEX "RiskEvent_elderId_status_idx" ON "RiskEvent"("elderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_riskEventId_key" ON "WorkOrder"("riskEventId");

-- CreateIndex
CREATE INDEX "WorkOrder_status_deadline_idx" ON "WorkOrder"("status", "deadline");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceEvaluation_workOrderId_key" ON "ServiceEvaluation"("workOrderId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "Elder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElderFamilyLink" ADD CONSTRAINT "ElderFamilyLink_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "Elder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElderFamilyLink" ADD CONSTRAINT "ElderFamilyLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "Elder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRecord" ADD CONSTRAINT "VisitRecord_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "Elder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRecord" ADD CONSTRAINT "VisitRecord_gridWorkerId_fkey" FOREIGN KEY ("gridWorkerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceData" ADD CONSTRAINT "DeviceData_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "Elder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskEvent" ADD CONSTRAINT "RiskEvent_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "Elder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "Elder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_riskEventId_fkey" FOREIGN KEY ("riskEventId") REFERENCES "RiskEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderTimeline" ADD CONSTRAINT "WorkOrderTimeline_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEvaluation" ADD CONSTRAINT "ServiceEvaluation_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
