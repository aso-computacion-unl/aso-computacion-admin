-- S10d moderation rules the first forum migration left open (T15 follow-ups L36). No table or column
-- changes, no data rewritten: it swaps two unique indexes and adds CHECK constraints, so it is safe on a
-- populated database and the previous build keeps working against it.
--
-- 1. One report per member per post was "forever": a student whose report was dismissed could never report
--    the same post again. Now only an OPEN report is unique per reporter and target (partial indexes, raw
--    SQL: Prisma cannot declare them), so a closed one frees the slot.
-- 2. `hiddenBy`, `lockedBy`, `suspendedBy`, `resolvedBy` and `resolutionNote` only make sense with the time
--    the action happened. The reverse is not required: an emergency (break-glass) moderator has no user id.
--
-- Rollback: DROP INDEX "ForumReport_open_thread_key", "ForumReport_open_reply_key"; then recreate the two
-- full unique indexes (reporterId, threadId) and (reporterId, replyId) as in 20261026140000_add_forum
-- (it fails if a reporter has since reported a post twice: close the duplicates first); then DROP each CHECK
-- named below.

-- DropIndex
DROP INDEX "ForumReport_reporterId_threadId_key";

-- DropIndex
DROP INDEX "ForumReport_reporterId_replyId_key";

-- CreateIndex (partial: Prisma cannot declare it)
CREATE UNIQUE INDEX "ForumReport_open_thread_key" ON "ForumReport"("reporterId", "threadId") WHERE "status" = 'OPEN';

-- CreateIndex (partial: Prisma cannot declare it)
CREATE UNIQUE INDEX "ForumReport_open_reply_key" ON "ForumReport"("reporterId", "replyId") WHERE "status" = 'OPEN';

-- Constraints
ALTER TABLE "ForumThread" ADD CONSTRAINT "ForumThread_hidden_by" CHECK ("hiddenBy" IS NULL OR "hiddenAt" IS NOT NULL);
ALTER TABLE "ForumThread" ADD CONSTRAINT "ForumThread_locked_by" CHECK ("lockedBy" IS NULL OR "lockedAt" IS NOT NULL);
ALTER TABLE "ForumReply" ADD CONSTRAINT "ForumReply_hidden_by" CHECK ("hiddenBy" IS NULL OR "hiddenAt" IS NOT NULL);
ALTER TABLE "ForumMember" ADD CONSTRAINT "ForumMember_suspended_by" CHECK ("suspendedBy" IS NULL OR "suspendedAt" IS NOT NULL);
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_resolved_by" CHECK ("resolvedBy" IS NULL OR "resolvedAt" IS NOT NULL);
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_resolution_note" CHECK ("resolutionNote" IS NULL OR "resolvedAt" IS NOT NULL);
