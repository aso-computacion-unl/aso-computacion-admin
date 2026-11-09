-- Daily budget of outgoing email: one row per calendar day in Ecuador. Additive: a new table nothing else touches.

-- CreateTable
CREATE TABLE "MailDailyCounter" (
    "day" TEXT NOT NULL,
    "sent" INTEGER NOT NULL,

    CONSTRAINT "MailDailyCounter_pkey" PRIMARY KEY ("day"),
    CONSTRAINT "MailDailyCounter_day_check" CHECK ("day" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
    CONSTRAINT "MailDailyCounter_sent_check" CHECK ("sent" >= 0)
);
