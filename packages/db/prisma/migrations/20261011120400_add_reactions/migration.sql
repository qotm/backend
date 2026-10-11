-- CreateTable
CREATE TABLE "likes" (
    "user_id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pk" PRIMARY KEY ("user_id","quote_id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "user_id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pk" PRIMARY KEY ("user_id","quote_id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "user_id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendations_pk" PRIMARY KEY ("user_id","quote_id")
);

-- CreateIndex
CREATE INDEX "likes_quote_id_idx" ON "likes"("quote_id");

-- CreateIndex
CREATE INDEX "favorites_quote_id_idx" ON "favorites"("quote_id");

-- CreateIndex
CREATE INDEX "favorites_user_id_created_at_idx" ON "favorites"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "recommendations_quote_id_idx" ON "recommendations"("quote_id");

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_quote_fk" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_quote_fk" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_user_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_quote_fk" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
