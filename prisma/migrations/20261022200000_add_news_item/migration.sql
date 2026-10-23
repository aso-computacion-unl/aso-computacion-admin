-- CreateTable
CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "publishedAt" DATE NOT NULL,
    "coverUrl" TEXT,
    "coverPublicId" TEXT,
    "coverWidth" INTEGER,
    "coverHeight" INTEGER,
    "coverAlt" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsItem_pkey" PRIMARY KEY ("id"),
    -- A cover is whole or absent: never a url without alt text, dimensions or a publicId to destroy.
    CONSTRAINT "NewsItem_cover_all_or_none" CHECK (
        ("coverUrl" IS NULL AND "coverPublicId" IS NULL AND "coverWidth" IS NULL AND "coverHeight" IS NULL AND "coverAlt" IS NULL)
        OR
        ("coverUrl" IS NOT NULL AND "coverPublicId" IS NOT NULL AND "coverWidth" IS NOT NULL AND "coverHeight" IS NOT NULL AND "coverAlt" IS NOT NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsItem_slug_key" ON "NewsItem"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "NewsItem_coverPublicId_key" ON "NewsItem"("coverPublicId");

-- CreateIndex
CREATE INDEX "NewsItem_publishedAt_createdAt_idx" ON "NewsItem"("publishedAt" DESC, "createdAt" DESC);
