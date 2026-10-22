-- AlterTable: add-only. Existing rows become exact dates ('day').
ALTER TABLE "Event" ADD COLUMN "datePrecision" TEXT NOT NULL DEFAULT 'day';

-- A month-only date is stored as the first of its month; the domain enforces that, the database pins the vocabulary.
ALTER TABLE "Event" ADD CONSTRAINT "Event_datePrecision_check" CHECK ("datePrecision" IN ('day', 'month'));
