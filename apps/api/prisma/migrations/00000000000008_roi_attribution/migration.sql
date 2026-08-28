-- ROI attribution: flag purchases that happened shortly after the system
-- recognized the member (existing rows stay false — attribution starts now)
ALTER TABLE "Purchase" ADD COLUMN "assisted" BOOLEAN NOT NULL DEFAULT false;
