import "server-only";
import { Prisma, type TerminalCommand as PrismaTerminalCommand } from "@prisma/client";

import type { OrderedContentRepository } from "@/application/ports/ordered-content-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { CommandNameConflictError } from "@/domain/command-name";
import type { TerminalCommand } from "@/domain/terminal-command";

import { prisma } from "../prisma/client";
import { toDomain, toPrismaCreate, toPrismaUpdate } from "./terminal-command.mapper";
import { PurgeableTrashPrismaRepository } from "./trashable-prisma.repository";

/** The command check in the use case is advisory; the unique index is what actually decides a race. */
function rethrowCommandCollision(error: unknown, command: TerminalCommand): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new CommandNameConflictError("command", command.props.command, "command");
  }

  throw error;
}

export class TerminalCommandPrismaRepository
  extends PurgeableTrashPrismaRepository<TerminalCommand, PrismaTerminalCommand>
  implements OrderedContentRepository<TerminalCommand>
{
  protected readonly delegate = prisma.terminalCommand;
  protected readonly trashConfig = {
    notFound: "Terminal command not found",
    toDomain,
    toUpdate: toPrismaUpdate,
    mapConflict: rethrowCommandCollision,
  };

  async create(command: TerminalCommand): Promise<TerminalCommand> {
    try {
      return toDomain(await prisma.terminalCommand.create({ data: toPrismaCreate(command) }));
    } catch (error) {
      return rethrowCommandCollision(error, command);
    }
  }

  async getById(id: string): Promise<TerminalCommand | null> {
    const record = await prisma.terminalCommand.findUnique({ where: { id, deletedAt: null } });

    return record ? toDomain(record) : null;
  }

  async list(): Promise<TerminalCommand[]> {
    // createdAt and id break ties so the list and the move use case agree on the order.
    const records = await prisma.terminalCommand.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] });

    return records.map(toDomain);
  }

  async update(command: TerminalCommand): Promise<TerminalCommand> {
    let record;

    try {
      [record] = await prisma.terminalCommand.updateManyAndReturn({ where: { id: command.props.id, deletedAt: null }, data: toPrismaUpdate(command) });
    } catch (error) {
      return rethrowCommandCollision(error, command);
    }

    if (!record) {
      throw new NotFoundError("Terminal command not found");
    }

    return toDomain(record);
  }

  async saveOrder(orderedIds: readonly string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const [sortOrder, id] of orderedIds.entries()) {
        const { count } = await tx.terminalCommand.updateMany({ where: { id, deletedAt: null }, data: { sortOrder, updatedAt: new Date() } });

        if (count === 0) {
          throw new NotFoundError("Terminal command not found");
        }
      }
    });
  }
}
