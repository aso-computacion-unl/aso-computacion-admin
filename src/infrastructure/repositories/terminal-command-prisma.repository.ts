import "server-only";
import { Prisma } from "@prisma/client";

import type { OrderedContentRepository } from "@/application/ports/ordered-content-repository.port";
import type { TrashedItem } from "@/application/ports/trashable-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { CommandNameConflictError } from "@/domain/command-name";
import type { TerminalCommand } from "@/domain/terminal-command";

import { prisma } from "../prisma/client";
import { toDomain, toPrismaCreate, toPrismaUpdate } from "./terminal-command.mapper";
import { LIVE } from "./publication-filter";
import { toTrashedItem, TRASH_ORDER, TRASHED } from "./trash";

/** The command check in the use case is advisory; the unique index is what actually decides a race. */
function rethrowCommandCollision(error: unknown, command: TerminalCommand): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new CommandNameConflictError("command", command.props.command, "command");
  }

  throw error;
}

export class TerminalCommandPrismaRepository implements OrderedContentRepository<TerminalCommand> {
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

  async delete(id: string): Promise<void> {
    const { count } = await prisma.terminalCommand.deleteMany({ where: { id } });

    if (count === 0) {
      throw new NotFoundError("Terminal command not found");
    }
  }

  async trash(id: string): Promise<void> {
    const { count } = await prisma.terminalCommand.updateMany({
      where: { id, ...LIVE },
      data: { deletedAt: new Date(), isPublished: false },
    });

    if (count === 0) {
      throw new NotFoundError("Terminal command not found");
    }
  }

  async getTrashed(id: string): Promise<TrashedItem<TerminalCommand> | null> {
    const record = await prisma.terminalCommand.findFirst({ where: { id, ...TRASHED } });

    return record ? toTrashedItem(toDomain(record), record.deletedAt) : null;
  }

  async listTrashed(): Promise<TrashedItem<TerminalCommand>[]> {
    const records = await prisma.terminalCommand.findMany({ where: TRASHED, orderBy: [...TRASH_ORDER] });

    return records.map((record) => toTrashedItem(toDomain(record), record.deletedAt));
  }

  async restore(command: TerminalCommand): Promise<TerminalCommand> {
    let record;

    try {
      [record] = await prisma.terminalCommand.updateManyAndReturn({
        where: { id: command.props.id, ...TRASHED },
        data: { ...toPrismaUpdate(command), deletedAt: null },
      });
    } catch (error) {
      return rethrowCommandCollision(error, command);
    }

    if (!record) {
      throw new NotFoundError("Terminal command not found");
    }

    return toDomain(record);
  }

  async purge(id: string): Promise<void> {
    const { count } = await prisma.terminalCommand.deleteMany({ where: { id, ...TRASHED } });

    if (count === 0) {
      throw new NotFoundError("Terminal command not found");
    }
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
