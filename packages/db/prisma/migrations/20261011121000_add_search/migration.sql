-- CreateIndex
CREATE INDEX "authors_name_trgm_idx" ON "authors" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "topics_name_trgm_idx" ON "topics" USING GIN ("name" gin_trgm_ops);

-- CreateIndex: full-text search over quote text. An expression index, which
-- Prisma cannot declare (see quotes.prisma); search matches it with
-- to_tsvector('english', text).
CREATE INDEX "quotes_text_fts_idx" ON "quotes" USING GIN (to_tsvector('english', "text"));
