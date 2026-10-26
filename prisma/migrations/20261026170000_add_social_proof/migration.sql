-- S9 social proof: impact stats, testimonials and sponsors, managed from the admin.
--
-- Additive: three new tables, nothing existing is touched. Each table is created with `deletedAt` (the
-- soft-delete column of S4) and the same ordered-list shape as Pillar and BoardMember.
-- Rollback: DROP TABLE "ImpactStat", "Testimonial", "Sponsor"; (they are not referenced by anything else).

-- CreateTable
CREATE TABLE "ImpactStat" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImpactStat_pkey" PRIMARY KEY ("id"),
    -- A trashed row is never public (the repository unpublishes it when it moves to the trash).
    CONSTRAINT "ImpactStat_trashed_unpublished" CHECK ("deletedAt" IS NULL OR "isPublished" = false)
);

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "photoUrl" TEXT,
    "photoPublicId" TEXT,
    "photoWidth" INTEGER,
    "photoHeight" INTEGER,
    "photoAlt" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id"),
    -- A photo is whole or absent: never a url without alt text, dimensions or a publicId to destroy.
    CONSTRAINT "Testimonial_photo_all_or_none" CHECK (
        ("photoUrl" IS NULL AND "photoPublicId" IS NULL AND "photoWidth" IS NULL AND "photoHeight" IS NULL AND "photoAlt" IS NULL)
        OR
        ("photoUrl" IS NOT NULL AND "photoPublicId" IS NOT NULL AND "photoWidth" IS NOT NULL AND "photoHeight" IS NOT NULL AND "photoAlt" IS NOT NULL)
    ),
    CONSTRAINT "Testimonial_trashed_unpublished" CHECK ("deletedAt" IS NULL OR "isPublished" = false)
);

-- CreateTable
CREATE TABLE "Sponsor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "logoPublicId" TEXT,
    "logoWidth" INTEGER,
    "logoHeight" INTEGER,
    "logoAlt" TEXT,
    "url" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sponsor_pkey" PRIMARY KEY ("id"),
    -- A logo is whole or absent: never a url without alt text, dimensions or a publicId to destroy.
    CONSTRAINT "Sponsor_logo_all_or_none" CHECK (
        ("logoUrl" IS NULL AND "logoPublicId" IS NULL AND "logoWidth" IS NULL AND "logoHeight" IS NULL AND "logoAlt" IS NULL)
        OR
        ("logoUrl" IS NOT NULL AND "logoPublicId" IS NOT NULL AND "logoWidth" IS NOT NULL AND "logoHeight" IS NOT NULL AND "logoAlt" IS NOT NULL)
    ),
    -- A sponsor without a logo cannot be published (it would render an empty slot).
    CONSTRAINT "Sponsor_published_needs_logo" CHECK ("isPublished" = false OR "logoUrl" IS NOT NULL),
    CONSTRAINT "Sponsor_trashed_unpublished" CHECK ("deletedAt" IS NULL OR "isPublished" = false)
);

-- CreateIndex
CREATE UNIQUE INDEX "Testimonial_photoPublicId_key" ON "Testimonial"("photoPublicId");

-- CreateIndex
CREATE UNIQUE INDEX "Sponsor_logoPublicId_key" ON "Sponsor"("logoPublicId");

-- CreateIndex
CREATE INDEX "ImpactStat_sortOrder_createdAt_idx" ON "ImpactStat"("sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "Testimonial_sortOrder_createdAt_idx" ON "Testimonial"("sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "Sponsor_sortOrder_createdAt_idx" ON "Sponsor"("sortOrder", "createdAt");
