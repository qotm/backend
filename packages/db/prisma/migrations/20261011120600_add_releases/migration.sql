-- CreateEnum
CREATE TYPE "ReleaseState" AS ENUM ('DRAFT', 'PREVIEW', 'PUBLISHED');

-- CreateTable
CREATE TABLE "releases" (
    "id" TEXT NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "state" "ReleaseState" NOT NULL DEFAULT 'DRAFT',
    "eligible_count" INTEGER NOT NULL DEFAULT 0,
    "added_count" INTEGER NOT NULL DEFAULT 0,
    "corrected_count" INTEGER NOT NULL DEFAULT 0,
    "withdrawn_count" INTEGER NOT NULL DEFAULT 0,
    "schema_version" INTEGER NOT NULL,
    "size_bytes" INTEGER,
    "sha256" CHAR(64),
    "artifact_key" VARCHAR(300),
    "manifest_key" VARCHAR(300),
    "preview_built_at" TIMESTAMP(3),
    "published_by_id" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "releases_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_quotes" (
    "release_id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "text_at_release" VARCHAR(280) NOT NULL,

    CONSTRAINT "release_quotes_pk" PRIMARY KEY ("release_id","quote_id")
);

-- CreateIndex
CREATE INDEX "releases_state_published_at_idx" ON "releases"("state", "published_at");

-- CreateIndex
CREATE INDEX "releases_published_by_id_idx" ON "releases"("published_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "releases_version_idx" ON "releases"("version");

-- CreateIndex
CREATE INDEX "release_quotes_quote_id_idx" ON "release_quotes"("quote_id");

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_published_by_fk" FOREIGN KEY ("published_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_quotes" ADD CONSTRAINT "release_quotes_release_fk" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_quotes" ADD CONSTRAINT "release_quotes_quote_fk" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
