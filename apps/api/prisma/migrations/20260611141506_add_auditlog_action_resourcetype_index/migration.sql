-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_createdAt_idx" ON "AuditLog"("resourceType", "createdAt");
