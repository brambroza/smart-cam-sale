-- Phase B: Store (branch) rows per organization
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Store_orgId_code_key" ON "Store"("orgId", "code");
CREATE INDEX "Store_orgId_idx" ON "Store"("orgId");

-- seed a default branch per existing org so reports have a store to hang on
INSERT INTO "Store" ("id", "orgId", "code", "name")
SELECT 'store_' || o."id", o."id", 'main', 'สาขาหลัก'
FROM "Organization" o;
