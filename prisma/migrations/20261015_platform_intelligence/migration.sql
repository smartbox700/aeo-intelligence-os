-- CreateTable
CREATE TABLE "PlatformIntelligenceRecord" (
    "id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "stableId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "recordRevision" INTEGER NOT NULL,
    "projectId" TEXT,
    "responseId" TEXT,
    "taskId" TEXT,
    "payload" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,
    "envelopeChecksum" TEXT NOT NULL,
    "contractVersion" TEXT NOT NULL,
    "registryVersion" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "previousChecksum" TEXT,

    CONSTRAINT "PlatformIntelligenceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformIntelligenceAuditEvent" (
    "id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "previousChecksum" TEXT,
    "checksum" TEXT NOT NULL,

    CONSTRAINT "PlatformIntelligenceAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformIntelligenceRecord_environment_projectId_domain_idx" ON "PlatformIntelligenceRecord"("environment", "projectId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformIntelligenceRecord_environment_domain_stableId_vers_key" ON "PlatformIntelligenceRecord"("environment", "domain", "stableId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformIntelligenceAuditEvent_environment_revision_key" ON "PlatformIntelligenceAuditEvent"("environment", "revision");

-- AddForeignKey
ALTER TABLE "PlatformIntelligenceRecord" ADD CONSTRAINT "PlatformIntelligenceRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformIntelligenceRecord" ADD CONSTRAINT "PlatformIntelligenceRecord_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "AIResponse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformIntelligenceRecord" ADD CONSTRAINT "PlatformIntelligenceRecord_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "OptimizationTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformIntelligenceRecord" ADD CONSTRAINT "PlatformIntelligenceRecord_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformIntelligenceAuditEvent" ADD CONSTRAINT "PlatformIntelligenceAuditEvent_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlatformIntelligenceRecord" ADD CONSTRAINT "pi_record_environment" CHECK (environment IN ('PRODUCTION','SYNTHETIC'));
ALTER TABLE "PlatformIntelligenceRecord" ADD CONSTRAINT "pi_record_domain" CHECK (domain IN ('KNOWLEDGE','RULE','RULESET','OBSERVATION','READINESS_POLICY','READINESS','ACTION','EXECUTION','MEASUREMENT','EXPERIMENT','EXPERIMENT_RESULT','INSIGHT_POLICY','INSIGHT'));
ALTER TABLE "PlatformIntelligenceRecord" ADD CONSTRAINT "pi_record_positive_version" CHECK (version > 0 AND "recordRevision" > 0);
ALTER TABLE "PlatformIntelligenceRecord" ADD CONSTRAINT "pi_record_hashes" CHECK (checksum ~ '^[a-f0-9]{64}$' AND "envelopeChecksum" ~ '^[a-f0-9]{64}$');
ALTER TABLE "PlatformIntelligenceRecord" ADD CONSTRAINT "pi_record_project_scope" CHECK (domain NOT IN ('OBSERVATION','READINESS','EXECUTION','MEASUREMENT','EXPERIMENT','EXPERIMENT_RESULT') OR "projectId" IS NOT NULL);
ALTER TABLE "PlatformIntelligenceRecord" ADD CONSTRAINT "pi_record_source_scope" CHECK (("responseId" IS NULL OR (domain='OBSERVATION' AND "projectId" IS NOT NULL)) AND ("taskId" IS NULL OR (domain='EXECUTION' AND "projectId" IS NOT NULL)));
ALTER TABLE "PlatformIntelligenceAuditEvent" ADD CONSTRAINT "pi_audit_environment" CHECK (environment IN ('PRODUCTION','SYNTHETIC') AND revision > 0);

