-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('taller', 'charla', 'evento', 'comunidad');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" DATE,
    "type" "EventType",
    "commitMessage" TEXT,
    "hora" TEXT,
    "lugar" TEXT,
    "para" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "linkUrl" TEXT,
    "linkLabel" TEXT,
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventPhoto" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "alt" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_isPublished_date_idx" ON "Event"("isPublished", "date");

-- CreateIndex
CREATE UNIQUE INDEX "EventPhoto_publicId_key" ON "EventPhoto"("publicId");

-- CreateIndex
CREATE INDEX "EventPhoto_eventId_isActive_sortOrder_idx" ON "EventPhoto"("eventId", "isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "EventPhoto" ADD CONSTRAINT "EventPhoto_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

