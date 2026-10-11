-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('ATTRIBUTION', 'CONTENT', 'ORIGINALITY', 'DUPLICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'DISPUTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReviewKind" AS ENUM ('VERIFICATION', 'MODERATION', 'CURATION');

-- CreateEnum
CREATE TYPE "ReviewOutcome" AS ENUM ('VERIFY', 'NEEDS_EVIDENCE', 'REJECT', 'CURATE', 'KEEP_OUT', 'PUBLISH', 'MARK_DISPUTED', 'WITHDRAW');

-- CreateEnum
CREATE TYPE "MatchMethod" AS ENUM ('EXACT', 'FUZZY', 'AUTHOR');

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "quote_id" TEXT NOT NULL,
    "reporter_id" TEXT,
    "reason" "ReportReason" NOT NULL,
    "details" VARCHAR(2000),
    "status" "ReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_decisions" (
    "id" TEXT NOT NULL,
    "kind" "ReviewKind" NOT NULL,
    "quote_id" TEXT NOT NULL,
    "report_id" TEXT,
    "outcome" "ReviewOutcome" NOT NULL,
    "note" VARCHAR(1000),
    "checklist" JSONB,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_decisions_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_results" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "matched_quote_id" TEXT NOT NULL,
    "method" "MatchMethod" NOT NULL,
    "score" REAL NOT NULL,
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_results_pk" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "reports_quote_id_idx" ON "reports"("quote_id");

-- CreateIndex
CREATE INDEX "reports_reporter_id_idx" ON "reports"("reporter_id");

-- CreateIndex
CREATE UNIQUE INDEX "reports_number_idx" ON "reports"("number");

-- CreateIndex
CREATE INDEX "review_decisions_quote_id_created_at_idx" ON "review_decisions"("quote_id", "created_at");

-- CreateIndex
CREATE INDEX "review_decisions_report_id_idx" ON "review_decisions"("report_id");

-- CreateIndex
CREATE INDEX "review_decisions_actor_id_idx" ON "review_decisions"("actor_id");

-- CreateIndex
CREATE INDEX "review_decisions_kind_created_at_idx" ON "review_decisions"("kind", "created_at");

-- CreateIndex
CREATE INDEX "match_results_matched_quote_id_idx" ON "match_results"("matched_quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_results_pair_idx" ON "match_results"("quote_id", "matched_quote_id", "method");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_quote_fk" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_fk" FOREIGN KEY ("reporter_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_quote_fk" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_report_fk" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_actor_fk" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_quote_fk" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_matched_quote_fk" FOREIGN KEY ("matched_quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
