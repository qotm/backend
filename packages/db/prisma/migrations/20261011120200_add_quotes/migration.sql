-- CreateEnum
CREATE TYPE "QuoteType" AS ENUM ('CANONICAL', 'ORIGINAL', 'PRIVATE');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('PRIVATE', 'SUBMITTED', 'CURATION_REVIEW', 'CURATED', 'DATASET_RELEASE', 'UNDER_REVIEW', 'VERIFIED', 'ORIGINALITY_CHECK', 'PUBLISHED', 'COMMUNITY_DISCOVERY', 'CURATION_CANDIDATE', 'NEEDS_EVIDENCE', 'DISPUTED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "public_id" VARCHAR(8) NOT NULL,
    "text" VARCHAR(280) NOT NULL,
    "type" "QuoteType" NOT NULL,
    "status" "QuoteStatus" NOT NULL,
    "author_id" TEXT,
    "source_id" TEXT,
    "work" VARCHAR(300),
    "year" SMALLINT,
    "source_url" VARCHAR(2048),
    "context" VARCHAR(1000),
    "contributor_id" TEXT,
    "verifier_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "recommend_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_topics" (
    "quote_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,

    CONSTRAINT "quote_topics_pk" PRIMARY KEY ("quote_id","topic_id")
);

-- CreateTable
CREATE TABLE "quote_events" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "from_status" "QuoteStatus",
    "to_status" "QuoteStatus" NOT NULL,
    "actor_id" TEXT,
    "note" VARCHAR(1000),
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_events_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrections" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "old_text" VARCHAR(280) NOT NULL,
    "new_text" VARCHAR(280) NOT NULL,
    "actor_id" TEXT,
    "note" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corrections_pk" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quotes_status_published_at_idx" ON "quotes"("status", "published_at");

-- CreateIndex
CREATE INDEX "quotes_type_status_idx" ON "quotes"("type", "status");

-- CreateIndex
CREATE INDEX "quotes_author_id_idx" ON "quotes"("author_id");

-- CreateIndex
CREATE INDEX "quotes_source_id_idx" ON "quotes"("source_id");

-- CreateIndex
CREATE INDEX "quotes_contributor_id_created_at_idx" ON "quotes"("contributor_id", "created_at");

-- CreateIndex
CREATE INDEX "quotes_verifier_id_idx" ON "quotes"("verifier_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_public_id_idx" ON "quotes"("public_id");

-- CreateIndex
CREATE INDEX "quote_topics_topic_id_idx" ON "quote_topics"("topic_id");

-- CreateIndex
CREATE INDEX "quote_events_quote_id_at_idx" ON "quote_events"("quote_id", "at");

-- CreateIndex
CREATE INDEX "quote_events_actor_id_idx" ON "quote_events"("actor_id");

-- CreateIndex
CREATE INDEX "corrections_quote_id_created_at_idx" ON "corrections"("quote_id", "created_at");

-- CreateIndex
CREATE INDEX "corrections_actor_id_idx" ON "corrections"("actor_id");

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_author_fk" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_source_fk" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_contributor_fk" FOREIGN KEY ("contributor_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_verifier_fk" FOREIGN KEY ("verifier_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_topics" ADD CONSTRAINT "quote_topics_quote_fk" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_topics" ADD CONSTRAINT "quote_topics_topic_fk" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_events" ADD CONSTRAINT "quote_events_quote_fk" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_events" ADD CONSTRAINT "quote_events_actor_fk" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_quote_fk" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_actor_fk" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
