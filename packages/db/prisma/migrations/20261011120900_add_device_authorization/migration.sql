-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "session_id" TEXT;

-- CreateTable
CREATE TABLE "device_code" (
    "id" TEXT NOT NULL,
    "device_code" TEXT NOT NULL,
    "user_code" TEXT NOT NULL,
    "user_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "last_polled_at" TIMESTAMP(3),
    "polling_interval" INTEGER,
    "client_id" TEXT,
    "scope" TEXT,

    CONSTRAINT "device_code_pk" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "device_code_user_id_idx" ON "device_code"("user_id");

-- CreateIndex
CREATE INDEX "device_code_expires_at_idx" ON "device_code"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "device_code_device_code_idx" ON "device_code"("device_code");

-- CreateIndex
CREATE UNIQUE INDEX "device_code_user_code_idx" ON "device_code"("user_code");

-- CreateIndex
CREATE UNIQUE INDEX "devices_session_id_idx" ON "devices"("session_id");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_session_fk" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_code" ADD CONSTRAINT "device_code_user_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

