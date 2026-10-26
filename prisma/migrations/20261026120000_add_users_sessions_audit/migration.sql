-- S5 users, sessions and audit log. Purely additive: three new tables, two new enums, no existing
-- table or row is touched, so it is safe on a populated database and the previous admin build keeps
-- working against it.
--
-- Rollback: DROP TABLE "AuditLog", "Session", "User"; DROP TYPE "ActorKind", "UserRole";
-- (the previous build ignores these tables; run it only after rolling the app back).
--
-- Rules Prisma cannot express are CHECK constraints below: lower-cased email, short text columns,
-- a user session has a user and a break-glass one has none, and "system" is never a session kind.

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EDITOR');

-- CreateEnum
CREATE TYPE "ActorKind" AS ENUM ('user', 'break_glass', 'system');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "kind" "ActorKind" NOT NULL DEFAULT 'user',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipHash" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "actorKind" "ActorKind" NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_at_idx" ON "AuditLog"("entityType", "at" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_at_idx" ON "AuditLog"("actorUserId", "at" DESC);

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Constraints
ALTER TABLE "User" ADD CONSTRAINT "User_email_lowercase" CHECK ("email" = lower("email") AND "email" <> '');
ALTER TABLE "User" ADD CONSTRAINT "User_name_length" CHECK (char_length("name") BETWEEN 1 AND 120);
ALTER TABLE "Session" ADD CONSTRAINT "Session_kind_user" CHECK (
    ("kind" = 'user' AND "userId" IS NOT NULL) OR ("kind" = 'break_glass' AND "userId" IS NULL)
);
ALTER TABLE "Session" ADD CONSTRAINT "Session_userAgent_length" CHECK ("userAgent" IS NULL OR char_length("userAgent") <= 200);
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_summary_length" CHECK (char_length("summary") <= 200);
