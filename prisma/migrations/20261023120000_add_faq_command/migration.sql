-- AlterTable
ALTER TABLE "Faq" ADD COLUMN     "command" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Faq_command_key" ON "Faq"("command");
