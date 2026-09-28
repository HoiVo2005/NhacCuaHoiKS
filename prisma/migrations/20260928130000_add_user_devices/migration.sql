-- Bang thiet bi / phien dang nhap: hien IP - ten may - vi tri, dang xuat tu xa va chan dang nhap.
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceKey" VARCHAR(64) NOT NULL,
    "label" VARCHAR(100),
    "deviceName" VARCHAR(120) NOT NULL,
    "browser" VARCHAR(60),
    "platform" VARCHAR(60),
    "userAgent" VARCHAR(500),
    "ipAddress" VARCHAR(60),
    "location" VARCHAR(160),
    "locationUpdatedAt" TIMESTAMP(3),
    "firstLoginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedByEmail" VARCHAR(255),
    "blockedAt" TIMESTAMP(3),
    "blockedByEmail" VARCHAR(255),
    "blockedReason" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_devices_userId_deviceKey_key" ON "user_devices"("userId", "deviceKey");

CREATE INDEX "user_devices_userId_lastSeenAt_idx" ON "user_devices"("userId", "lastSeenAt");

CREATE INDEX "user_devices_blockedAt_idx" ON "user_devices"("blockedAt");

ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
