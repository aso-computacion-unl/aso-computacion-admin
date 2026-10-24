-- CreateTable
CREATE TABLE "TerminalCommand" (
    "id" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerminalCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TerminalCommand_command_key" ON "TerminalCommand"("command");

-- CreateIndex
CREATE INDEX "TerminalCommand_sortOrder_createdAt_idx" ON "TerminalCommand"("sortOrder", "createdAt");

