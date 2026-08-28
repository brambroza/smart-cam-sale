-- ConsentRecord: PDPA evidence trail for biometric consent
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "memberId" TEXT,
    "action" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'face_recognition',
    "policyVersion" TEXT NOT NULL,
    "policyHash" TEXT,
    "method" TEXT NOT NULL DEFAULT 'enroll_console',
    "staffUserId" TEXT,
    "staffUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConsentRecord_memberId_createdAt_idx" ON "ConsentRecord"("memberId", "createdAt");

ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
