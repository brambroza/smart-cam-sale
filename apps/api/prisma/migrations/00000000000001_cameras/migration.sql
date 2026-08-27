-- Camera registry for IP-camera bridge configuration
CREATE TABLE "Camera" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 554,
    "username" TEXT NOT NULL DEFAULT 'admin',
    "password" TEXT NOT NULL,
    "streamPath" TEXT,
    "quality" TEXT NOT NULL DEFAULT 'sub',
    "channel" TEXT NOT NULL,
    "bridgeId" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Camera_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Camera_channel_key" ON "Camera"("channel");
CREATE INDEX "Camera_bridgeId_enabled_idx" ON "Camera"("bridgeId", "enabled");
