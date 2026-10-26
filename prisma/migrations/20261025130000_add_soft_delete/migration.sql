-- S4 soft delete: content is moved to the trash (deletedAt set) instead of being removed.
--
-- Safe on a populated database: every statement is additive or swaps an index.
--   * ADD COLUMN of a nullable column without a default is a catalog-only change in Postgres:
--     no table rewrite, and every existing row gets deletedAt = NULL (live, exactly as before).
--   * Each partial unique index is built BEFORE the old unique index is dropped, so the
--     column is never left without a uniqueness guarantee. The partial predicate is a subset
--     of what the old index enforced, so existing data satisfies it.
--   * No data is read, moved or deleted.
--
-- Rollback (only while the trash is empty, or after emptying it; see docs/DEPLOY.md):
--   CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");  (same for NewsItem.slug, Faq.command, TerminalCommand.command)
--   DROP INDEX "Event_slug_live_key";                          (same for the other three)
--   ALTER TABLE "Event" DROP COLUMN "deletedAt";               (same for the other six tables)

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "deletedAt" TIMESTAMP(3);
ALTER TABLE "Faq" ADD COLUMN     "deletedAt" TIMESTAMP(3);
ALTER TABLE "TerminalCommand" ADD COLUMN     "deletedAt" TIMESTAMP(3);
ALTER TABLE "SocialLink" ADD COLUMN     "deletedAt" TIMESTAMP(3);
ALTER TABLE "Pillar" ADD COLUMN     "deletedAt" TIMESTAMP(3);
ALTER TABLE "NewsItem" ADD COLUMN     "deletedAt" TIMESTAMP(3);
ALTER TABLE "BoardMember" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- Uniqueness now applies to live rows only: a trashed row never blocks a new one.
-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_live_key" ON "Event"("slug") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "NewsItem_slug_live_key" ON "NewsItem"("slug") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "Faq_command_live_key" ON "Faq"("command") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "TerminalCommand_command_live_key" ON "TerminalCommand"("command") WHERE "deletedAt" IS NULL;

-- DropIndex
DROP INDEX "Event_slug_key";
DROP INDEX "NewsItem_slug_key";
DROP INDEX "Faq_command_key";
DROP INDEX "TerminalCommand_command_key";
