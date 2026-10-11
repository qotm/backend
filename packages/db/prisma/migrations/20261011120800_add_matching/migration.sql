-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "attribution" VARCHAR(160);

-- CreateIndex
CREATE INDEX "quotes_text_trgm_idx" ON "quotes" USING GIN ("text" gin_trgm_ops);
