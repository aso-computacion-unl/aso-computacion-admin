import type { Prisma, TerminalCommand as PrismaTerminalCommand } from "@prisma/client";

import { TerminalCommand } from "@/domain/terminal-command";

export function toDomain(record: PrismaTerminalCommand): TerminalCommand {
  return TerminalCommand.reconstitute({
    id: record.id,
    command: record.command,
    description: record.description,
    output: record.output,
    sortOrder: record.sortOrder,
    isPublished: record.isPublished,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export function toPrismaCreate(command: TerminalCommand): Prisma.TerminalCommandUncheckedCreateInput {
  return { ...command.props };
}

/** Mutable columns only: id and createdAt never change after creation. */
export function toPrismaUpdate(command: TerminalCommand): Prisma.TerminalCommandUncheckedUpdateManyInput {
  const data: Partial<Prisma.TerminalCommandUncheckedCreateInput> = toPrismaCreate(command);

  delete data.id;
  delete data.createdAt;

  return data;
}
