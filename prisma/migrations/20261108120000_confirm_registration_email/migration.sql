-- Open-form registrations confirm their email before they take a seat; reminders before the event.
-- Additive: three nullable columns. Every existing row was already a reserved seat, so it is backfilled as
-- confirmed at its creation time and keeps counting exactly as before.

-- AlterTable
ALTER TABLE "EventRegistration"
    ADD COLUMN "institution" TEXT,
    ADD COLUMN "confirmedAt" TIMESTAMP(3),
    ADD COLUMN "reminderSentAt" TIMESTAMP(3);

UPDATE "EventRegistration" SET "confirmedAt" = "createdAt";

ALTER TABLE "EventRegistration"
    ADD CONSTRAINT "EventRegistration_institution_check" CHECK ("institution" IS NULL OR char_length("institution") BETWEEN 1 AND 120),
    -- A UNL row collects no institution either, and Google verified its email: it is born confirmed.
    DROP CONSTRAINT "EventRegistration_unl_data_check",
    ADD CONSTRAINT "EventRegistration_unl_data_check" CHECK ("mode" <> 'unl' OR ("career" IS NULL AND "semester" IS NULL AND "institution" IS NULL AND "confirmedAt" IS NOT NULL)),
    -- Only a confirmed registration gets a reminder.
    ADD CONSTRAINT "EventRegistration_reminder_check" CHECK ("reminderSentAt" IS NULL OR "confirmedAt" IS NOT NULL);
