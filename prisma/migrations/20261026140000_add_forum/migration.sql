-- S10 student forum. Purely additive: seven new tables and two new enums, no existing table or row
-- is touched, so it is safe on a populated database and the previous admin build keeps working
-- against it (it ignores these tables).
--
-- Rollback: DROP TABLE "ForumReport", "ForumReaction", "ForumReply", "ForumThread", "ForumCategory",
-- "ForumSession", "ForumMember"; DROP TYPE "ForumReportStatus", "ForumMemberStatus";
-- (run it only after rolling the app back).
--
-- Rules Prisma cannot express are CHECK constraints at the end: lower-cased email, short text columns,
-- a reaction or a report has exactly one target, a suspended member says when, and a closed report
-- says when it was closed.

-- CreateEnum
CREATE TYPE "ForumMemberStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ForumReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "ForumMember" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "googleSub" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "ForumMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspendedAt" TIMESTAMP(3),
    "suspendedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "ForumMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumSession" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipHash" TEXT,

    CONSTRAINT "ForumSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumThread" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "hiddenAt" TIMESTAMP(3),
    "hiddenBy" TEXT,
    "bestReplyId" TEXT,

    CONSTRAINT "ForumThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumReply" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),
    "hiddenBy" TEXT,

    CONSTRAINT "ForumReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumReaction" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "threadId" TEXT,
    "replyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "threadId" TEXT,
    "replyId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "ForumReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,

    CONSTRAINT "ForumReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ForumMember_email_key" ON "ForumMember"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ForumMember_googleSub_key" ON "ForumMember"("googleSub");

-- CreateIndex
CREATE INDEX "ForumSession_memberId_revokedAt_idx" ON "ForumSession"("memberId", "revokedAt");

-- CreateIndex
CREATE INDEX "ForumSession_expiresAt_idx" ON "ForumSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ForumCategory_slug_key" ON "ForumCategory"("slug");

-- CreateIndex
CREATE INDEX "ForumCategory_sortOrder_createdAt_idx" ON "ForumCategory"("sortOrder", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ForumThread_bestReplyId_key" ON "ForumThread"("bestReplyId");

-- CreateIndex
CREATE INDEX "ForumThread_categoryId_lastActivityAt_idx" ON "ForumThread"("categoryId", "lastActivityAt" DESC);

-- CreateIndex
CREATE INDEX "ForumThread_authorId_createdAt_idx" ON "ForumThread"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "ForumReply_threadId_createdAt_idx" ON "ForumReply"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "ForumReply_authorId_createdAt_idx" ON "ForumReply"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "ForumReaction_threadId_idx" ON "ForumReaction"("threadId");

-- CreateIndex
CREATE INDEX "ForumReaction_replyId_idx" ON "ForumReaction"("replyId");

-- CreateIndex
CREATE UNIQUE INDEX "ForumReaction_memberId_threadId_key" ON "ForumReaction"("memberId", "threadId");

-- CreateIndex
CREATE UNIQUE INDEX "ForumReaction_memberId_replyId_key" ON "ForumReaction"("memberId", "replyId");

-- CreateIndex
CREATE INDEX "ForumReport_status_createdAt_idx" ON "ForumReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ForumReport_threadId_idx" ON "ForumReport"("threadId");

-- CreateIndex
CREATE INDEX "ForumReport_replyId_idx" ON "ForumReport"("replyId");

-- CreateIndex
CREATE UNIQUE INDEX "ForumReport_reporterId_threadId_key" ON "ForumReport"("reporterId", "threadId");

-- CreateIndex
CREATE UNIQUE INDEX "ForumReport_reporterId_replyId_key" ON "ForumReport"("reporterId", "replyId");

-- AddForeignKey
ALTER TABLE "ForumSession" ADD CONSTRAINT "ForumSession_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "ForumMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumThread" ADD CONSTRAINT "ForumThread_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ForumCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumThread" ADD CONSTRAINT "ForumThread_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "ForumMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumThread" ADD CONSTRAINT "ForumThread_bestReplyId_fkey" FOREIGN KEY ("bestReplyId") REFERENCES "ForumReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReply" ADD CONSTRAINT "ForumReply_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ForumThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReply" ADD CONSTRAINT "ForumReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "ForumMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReaction" ADD CONSTRAINT "ForumReaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "ForumMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReaction" ADD CONSTRAINT "ForumReaction_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ForumThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReaction" ADD CONSTRAINT "ForumReaction_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "ForumReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "ForumMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ForumThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "ForumReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Constraints
ALTER TABLE "ForumMember" ADD CONSTRAINT "ForumMember_email_lowercase" CHECK ("email" = lower("email") AND "email" <> '');
ALTER TABLE "ForumMember" ADD CONSTRAINT "ForumMember_displayName_length" CHECK (char_length("displayName") BETWEEN 1 AND 60);
ALTER TABLE "ForumMember" ADD CONSTRAINT "ForumMember_suspended_at" CHECK (("status" = 'SUSPENDED') = ("suspendedAt" IS NOT NULL));
ALTER TABLE "ForumSession" ADD CONSTRAINT "ForumSession_userAgent_length" CHECK ("userAgent" IS NULL OR char_length("userAgent") <= 200);
ALTER TABLE "ForumCategory" ADD CONSTRAINT "ForumCategory_name_length" CHECK (char_length("name") BETWEEN 1 AND 60);
ALTER TABLE "ForumCategory" ADD CONSTRAINT "ForumCategory_description_length" CHECK ("description" IS NULL OR char_length("description") <= 200);
ALTER TABLE "ForumThread" ADD CONSTRAINT "ForumThread_title_length" CHECK (char_length("title") BETWEEN 1 AND 120);
ALTER TABLE "ForumThread" ADD CONSTRAINT "ForumThread_body_length" CHECK (char_length("body") BETWEEN 1 AND 10000);
ALTER TABLE "ForumReply" ADD CONSTRAINT "ForumReply_body_length" CHECK (char_length("body") BETWEEN 1 AND 5000);
ALTER TABLE "ForumReaction" ADD CONSTRAINT "ForumReaction_one_target" CHECK (("threadId" IS NULL) <> ("replyId" IS NULL));
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_one_target" CHECK (("threadId" IS NULL) <> ("replyId" IS NULL));
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_reason_length" CHECK (char_length("reason") BETWEEN 1 AND 500);
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_resolutionNote_length" CHECK ("resolutionNote" IS NULL OR char_length("resolutionNote") <= 500);
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_resolved_at" CHECK (("status" = 'OPEN') = ("resolvedAt" IS NULL));
