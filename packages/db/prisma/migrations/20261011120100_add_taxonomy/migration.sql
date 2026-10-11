-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('BOOK', 'PAPER', 'MANUSCRIPT', 'LECTURE', 'TALK', 'POST');

-- CreateTable
CREATE TABLE "authors" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "born_year" SMALLINT,
    "died_year" SMALLINT,
    "description" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authors_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "author_id" TEXT,
    "year" SMALLINT,
    "kind" "SourceKind" NOT NULL,
    "url" VARCHAR(2048),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "description" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pk" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "authors_name_idx" ON "authors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "authors_slug_idx" ON "authors"("slug");

-- CreateIndex
CREATE INDEX "sources_author_id_idx" ON "sources"("author_id");

-- CreateIndex
CREATE INDEX "sources_title_idx" ON "sources"("title");

-- CreateIndex
CREATE UNIQUE INDEX "topics_name_idx" ON "topics"("name");

-- CreateIndex
CREATE UNIQUE INDEX "topics_slug_idx" ON "topics"("slug");

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_author_fk" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
