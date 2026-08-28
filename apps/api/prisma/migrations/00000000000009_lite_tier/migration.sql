-- Lite tier: orgs without camera features (phone-lookup workflow only)
ALTER TABLE "Organization" ADD COLUMN "cameraEnabled" BOOLEAN NOT NULL DEFAULT true;
