-- Publication window (S6): a published event or news item is public from publishAt (inclusive)
-- until unpublishAt (exclusive); NULL is open on that side. Both are UTC instants (TIMESTAMP(3), no
-- time zone, like every timestamp here); the admin edits them in Ecuador time. Every existing row
-- keeps both NULL, so nothing changes for content that never had a window.

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "publishAt" TIMESTAMP(3),
ADD COLUMN "unpublishAt" TIMESTAMP(3),
ADD CONSTRAINT "Event_publication_window_check" CHECK ("publishAt" IS NULL OR "unpublishAt" IS NULL OR "unpublishAt" > "publishAt");

-- AlterTable
ALTER TABLE "NewsItem" ADD COLUMN "publishAt" TIMESTAMP(3),
ADD COLUMN "unpublishAt" TIMESTAMP(3),
ADD CONSTRAINT "NewsItem_publication_window_check" CHECK ("publishAt" IS NULL OR "unpublishAt" IS NULL OR "unpublishAt" > "publishAt");

-- AlterTable
-- Time of the last deploy hook the landing ACCEPTED. NULL until one is recorded after this migration.
ALTER TABLE "DeployStatus" ADD COLUMN "lastSuccessAt" TIMESTAMP(3);
