-- AlterTable
ALTER TABLE "user" ADD COLUMN     "bio" VARCHAR(160),
ADD COLUMN     "email_on_review" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "handle" VARCHAR(30),
ADD COLUMN     "show_favorites" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing accounts get the handle new ones are assigned
-- (src/lib/handle.ts), suffixed from their id so it stays unique.
UPDATE "user" SET "handle" = (
  SELECT CASE WHEN length(base) >= 3 THEN base ELSE 'member' END
  FROM (
    SELECT trim(BOTH '_' FROM left(trim(BOTH '_' FROM regexp_replace(lower(split_part("email", '@', 1)), '[^a-z0-9_]+', '_', 'g')), 24)) AS base
  ) b
) || '_' || left(md5("id"), 4);

ALTER TABLE "user" ALTER COLUMN "handle" SET NOT NULL;

-- CreateTable
CREATE TABLE "handle_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "old_handle" VARCHAR(30) NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handle_history_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "authorized_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sync_at" TIMESTAMP(3),
    "dataset_version" VARCHAR(20),
    "revoked_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pk" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "handle_history_user_id_idx" ON "handle_history"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "handle_history_old_handle_idx" ON "handle_history"("old_handle");

-- CreateIndex
CREATE INDEX "devices_user_id_revoked_at_idx" ON "devices"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_handle_idx" ON "user"("handle");

-- AddForeignKey
ALTER TABLE "handle_history" ADD CONSTRAINT "handle_history_user_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
