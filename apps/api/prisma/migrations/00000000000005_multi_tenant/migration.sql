-- Phase A multi-tenancy: Organization root + orgId on every business table.
-- Existing rows are backfilled into a default org so current deployments keep
-- working with zero downtime.

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'pilot',
    "bridgeToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "Organization_bridgeToken_key" ON "Organization"("bridgeToken");

-- Default org for all pre-existing data. bridgeToken is random here; the API
-- adopts the legacy BRIDGE_TOKEN env for this org at startup when set.
INSERT INTO "Organization" ("id", "name", "slug", "plan", "bridgeToken")
VALUES ('org_default', 'ร้านหลัก', 'default', 'pilot', 'brg_' || md5(random()::text) || md5(random()::text));

-- Add orgId columns backfilled to the default org, then drop the default so
-- every new row must state its org explicitly.
ALTER TABLE "Member"        ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'org_default';
ALTER TABLE "Product"       ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'org_default';
ALTER TABLE "Camera"        ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'org_default';
ALTER TABLE "StaffUser"     ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'org_default';
ALTER TABLE "PosApiKey"     ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'org_default';
ALTER TABLE "Purchase"      ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'org_default';
ALTER TABLE "VisitLog"      ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'org_default';
ALTER TABLE "ConsentRecord" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'org_default';

ALTER TABLE "Member"        ALTER COLUMN "orgId" DROP DEFAULT;
ALTER TABLE "Product"       ALTER COLUMN "orgId" DROP DEFAULT;
ALTER TABLE "Camera"        ALTER COLUMN "orgId" DROP DEFAULT;
ALTER TABLE "StaffUser"     ALTER COLUMN "orgId" DROP DEFAULT;
ALTER TABLE "PosApiKey"     ALTER COLUMN "orgId" DROP DEFAULT;
ALTER TABLE "Purchase"      ALTER COLUMN "orgId" DROP DEFAULT;
ALTER TABLE "VisitLog"      ALTER COLUMN "orgId" DROP DEFAULT;
ALTER TABLE "ConsentRecord" ALTER COLUMN "orgId" DROP DEFAULT;

CREATE INDEX "Member_orgId_idx"        ON "Member"("orgId");
CREATE INDEX "Product_orgId_idx"       ON "Product"("orgId");
CREATE INDEX "Camera_orgId_idx"        ON "Camera"("orgId");
CREATE INDEX "StaffUser_orgId_idx"     ON "StaffUser"("orgId");
CREATE INDEX "PosApiKey_orgId_idx"     ON "PosApiKey"("orgId");
CREATE INDEX "Purchase_orgId_boughtAt_idx" ON "Purchase"("orgId", "boughtAt");
CREATE INDEX "VisitLog_orgId_visitedAt_idx" ON "VisitLog"("orgId", "visitedAt");
CREATE INDEX "ConsentRecord_orgId_idx" ON "ConsentRecord"("orgId");

-- Global uniques become per-org (username stays global on purpose)
DROP INDEX "Member_phone_key";
DROP INDEX "Member_email_key";
CREATE UNIQUE INDEX "Member_orgId_phone_key" ON "Member"("orgId", "phone");
CREATE UNIQUE INDEX "Member_orgId_email_key" ON "Member"("orgId", "email");

DROP INDEX "Product_sku_key";
CREATE UNIQUE INDEX "Product_orgId_sku_key" ON "Product"("orgId", "sku");

DROP INDEX "Camera_channel_key";
CREATE UNIQUE INDEX "Camera_orgId_channel_key" ON "Camera"("orgId", "channel");

-- The bootstrap 'admin' account becomes the platform superadmin
UPDATE "StaffUser" SET "role" = 'superadmin' WHERE "username" = 'admin';
