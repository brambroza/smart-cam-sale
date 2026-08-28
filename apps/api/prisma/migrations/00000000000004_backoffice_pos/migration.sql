-- Product.sku (barcode) for POS item matching
ALTER TABLE "Product" ADD COLUMN "sku" TEXT;
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- PosApiKey: integration keys for store POS systems
CREATE TABLE "PosApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "storeCode" TEXT NOT NULL DEFAULT 'main',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "PosApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PosApiKey_keyHash_key" ON "PosApiKey"("keyHash");
