ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "operations" JSONB;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "payload" JSONB;
CREATE TABLE IF NOT EXISTS "StaffUser" ("id" TEXT PRIMARY KEY, "namespace" TEXT NOT NULL DEFAULT 'local', "username" TEXT NOT NULL, "name" TEXT NOT NULL, "role" TEXT NOT NULL, "passwordHash" TEXT NOT NULL, "projectIds" TEXT[] NOT NULL, "disabled" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX IF NOT EXISTS "StaffUser_namespace_username_key" ON "StaffUser"("namespace","username");
CREATE TABLE IF NOT EXISTS "StaffSession" ("id" TEXT PRIMARY KEY, "tokenHash" TEXT NOT NULL UNIQUE, "userId" TEXT NOT NULL REFERENCES "StaffUser"("id") ON DELETE CASCADE, "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "AccessEvent" ("id" TEXT PRIMARY KEY, "namespace" TEXT NOT NULL DEFAULT 'local', "userId" TEXT, "projectId" TEXT, "action" TEXT NOT NULL, "success" BOOLEAN NOT NULL, "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS "AccessEvent_namespace_at_idx" ON "AccessEvent"("namespace","at");
