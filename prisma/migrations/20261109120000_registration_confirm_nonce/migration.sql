-- Only the latest confirmation link of a pending open-form registration works (D9): the link carries the attempt it
-- was issued for, and registering the same email again replaces it.
-- Additive: one nullable column, no backfill. A pending row from before this change keeps a null attempt and is
-- confirmed by a link that names none, until it expires (48 h) or its email registers again. Run it BEFORE the deploy
-- that sends links with the attempt (docs/DEPLOY.md).

-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN "confirmNonce" TEXT;
