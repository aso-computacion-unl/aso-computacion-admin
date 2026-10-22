-- CreateTable
CREATE TABLE "BoardMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "photoUrl" TEXT,
    "photoPublicId" TEXT,
    "photoWidth" INTEGER,
    "photoHeight" INTEGER,
    "photoAlt" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardMember_pkey" PRIMARY KEY ("id"),
    -- A photo is whole or absent: never a url without alt text, dimensions or a publicId to destroy.
    CONSTRAINT "BoardMember_photo_all_or_none" CHECK (
        ("photoUrl" IS NULL AND "photoPublicId" IS NULL AND "photoWidth" IS NULL AND "photoHeight" IS NULL AND "photoAlt" IS NULL)
        OR
        ("photoUrl" IS NOT NULL AND "photoPublicId" IS NOT NULL AND "photoWidth" IS NOT NULL AND "photoHeight" IS NOT NULL AND "photoAlt" IS NOT NULL)
    ),
    -- A member without a photo cannot be published (it would render an empty card).
    CONSTRAINT "BoardMember_published_needs_photo" CHECK ("isPublished" = false OR "photoUrl" IS NOT NULL)
);

-- CreateIndex
CREATE UNIQUE INDEX "BoardMember_photoPublicId_key" ON "BoardMember"("photoPublicId");

-- CreateIndex
CREATE INDEX "BoardMember_sortOrder_createdAt_idx" ON "BoardMember"("sortOrder", "createdAt");
