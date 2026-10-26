-- Event registration (S8): each event chooses how a person signs up (no registration, a verified UNL
-- Google account through the forum, or an open form). Existing events default to `none`, so nothing
-- changes for them. Capacity and deadline only make sense with a registration mode (CHECKs below).
-- The deadline is a UTC instant (TIMESTAMP(3)); the admin edits it in Ecuador time.

-- CreateEnum
CREATE TYPE "EventRegistrationMode" AS ENUM ('none', 'unl', 'open');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "registrationMode" "EventRegistrationMode" NOT NULL DEFAULT 'none',
ADD COLUMN "registrationCapacity" INTEGER,
ADD COLUMN "registrationDeadline" TIMESTAMP(3),
ADD CONSTRAINT "Event_registration_capacity_check" CHECK ("registrationCapacity" IS NULL OR "registrationCapacity" > 0),
ADD CONSTRAINT "Event_registration_settings_check" CHECK ("registrationMode" <> 'none' OR ("registrationCapacity" IS NULL AND "registrationDeadline" IS NULL));

-- CreateTable
-- Personal data: a unl row holds the forum member's verified name and email, an open row also the
-- career and semester. Never more than the mode needs.
CREATE TABLE "EventRegistration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "mode" "EventRegistrationMode" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "career" TEXT,
    "semester" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EventRegistration_mode_check" CHECK ("mode" <> 'none'),
    CONSTRAINT "EventRegistration_email_check" CHECK ("email" = lower("email") AND char_length("email") BETWEEN 3 AND 254),
    CONSTRAINT "EventRegistration_name_check" CHECK (char_length("name") BETWEEN 1 AND 120),
    CONSTRAINT "EventRegistration_career_check" CHECK ("career" IS NULL OR char_length("career") BETWEEN 1 AND 120),
    CONSTRAINT "EventRegistration_semester_check" CHECK ("semester" IS NULL OR "semester" BETWEEN 1 AND 12),
    CONSTRAINT "EventRegistration_unl_data_check" CHECK ("mode" <> 'unl' OR ("career" IS NULL AND "semester" IS NULL))
);

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_eventId_email_key" ON "EventRegistration"("eventId", "email");

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_createdAt_idx" ON "EventRegistration"("eventId", "createdAt");

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
