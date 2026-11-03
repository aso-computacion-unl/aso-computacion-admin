-- S11 admin invites. Purely additive: one new table, no existing table or row is touched, so it is
-- safe on a populated database and the previous admin build keeps working against it.
--
-- Rollback: DROP TABLE "AdminInvite";
-- (the previous build ignores this table; run it only after rolling the app back).
--
-- Rules Prisma cannot express are CHECK constraints below: lower-cased email, a SHA-256 hex token
-- hash, an expiry after the creation, used and revoked are exclusive, and a used invite names its user.

-- CreateTable
CREATE TABLE "AdminInvite" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AdminInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminInvite_tokenHash_key" ON "AdminInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminInvite_email_idx" ON "AdminInvite"("email");

-- CreateIndex
CREATE INDEX "AdminInvite_expiresAt_idx" ON "AdminInvite"("expiresAt");

-- Constraints
ALTER TABLE "AdminInvite" ADD CONSTRAINT "AdminInvite_email_lowercase" CHECK ("email" = lower("email") AND "email" <> '');
ALTER TABLE "AdminInvite" ADD CONSTRAINT "AdminInvite_tokenHash_sha256" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "AdminInvite" ADD CONSTRAINT "AdminInvite_expires_after_creation" CHECK ("expiresAt" > "createdAt");
ALTER TABLE "AdminInvite" ADD CONSTRAINT "AdminInvite_used_or_revoked" CHECK ("usedAt" IS NULL OR "revokedAt" IS NULL);
ALTER TABLE "AdminInvite" ADD CONSTRAINT "AdminInvite_used_by_user" CHECK (("usedAt" IS NULL) = ("usedByUserId" IS NULL));
