-- CreateTable
CREATE TABLE "Pillar" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imagePublicId" TEXT,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "imageAlt" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pillar_pkey" PRIMARY KEY ("id"),
    -- An image is whole or absent: never a url without alt text, dimensions or a publicId to destroy.
    CONSTRAINT "Pillar_image_all_or_none" CHECK (
        ("imageUrl" IS NULL AND "imagePublicId" IS NULL AND "imageWidth" IS NULL AND "imageHeight" IS NULL AND "imageAlt" IS NULL)
        OR
        ("imageUrl" IS NOT NULL AND "imagePublicId" IS NOT NULL AND "imageWidth" IS NOT NULL AND "imageHeight" IS NOT NULL AND "imageAlt" IS NOT NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "Pillar_imagePublicId_key" ON "Pillar"("imagePublicId");

-- CreateIndex
CREATE INDEX "Pillar_sortOrder_createdAt_idx" ON "Pillar"("sortOrder", "createdAt");
