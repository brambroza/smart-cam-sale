-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "MembershipTier" AS ENUM ('bronze', 'silver', 'gold', 'platinum');
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'unknown');

-- Member
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "gender" "Gender" NOT NULL DEFAULT 'unknown',
    "birthYear" INTEGER,
    "tier" "MembershipTier" NOT NULL DEFAULT 'bronze',
    "points" INTEGER NOT NULL DEFAULT 0,
    "avatarUrl" TEXT,
    "memberSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "faceOptIn" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Member_phone_key" ON "Member"("phone");
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");
CREATE INDEX "Member_tier_idx" ON "Member"("tier");

-- FaceEmbedding
CREATE TABLE "FaceEmbedding" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "embedding" vector(512) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceEmbedding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FaceEmbedding_memberId_idx" ON "FaceEmbedding"("memberId");
CREATE INDEX "FaceEmbedding_embedding_idx" ON "FaceEmbedding"
    USING hnsw ("embedding" vector_cosine_ops);
ALTER TABLE "FaceEmbedding" ADD CONSTRAINT "FaceEmbedding_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE;

-- Product
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT,
    "targetGender" "Gender" NOT NULL DEFAULT 'unknown',
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "timeOfDay" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- Purchase
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "boughtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storeCode" TEXT NOT NULL DEFAULT 'main',

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Purchase_memberId_boughtAt_idx" ON "Purchase"("memberId", "boughtAt");
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE;

-- PurchaseItem
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PurchaseItem_productId_idx" ON "PurchaseItem"("productId");
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE;
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id");

-- VisitLog
CREATE TABLE "VisitLog" (
    "id" TEXT NOT NULL,
    "memberId" TEXT,
    "matchedFace" BOOLEAN NOT NULL DEFAULT false,
    "estimatedAge" INTEGER,
    "gender" "Gender" NOT NULL DEFAULT 'unknown',
    "ageBucket" TEXT,
    "storeCode" TEXT NOT NULL DEFAULT 'main',
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VisitLog_visitedAt_idx" ON "VisitLog"("visitedAt");
