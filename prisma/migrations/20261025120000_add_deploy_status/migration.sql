-- CreateTable
CREATE TABLE "DeployStatus" (
    "id" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "httpStatus" INTEGER,
    "errorKind" TEXT,

    CONSTRAINT "DeployStatus_pkey" PRIMARY KEY ("id"),
    -- Singleton: the primary key can only ever hold this one value.
    CONSTRAINT "DeployStatus_singleton" CHECK ("id" = 'landing')
);
