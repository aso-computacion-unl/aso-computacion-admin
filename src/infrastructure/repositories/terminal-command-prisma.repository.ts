import "server-only";
import { Prisma, type TerminalCommand as PrismaTerminalCommand } from "@prisma/client";

import {
  fetchPage,
  type ListCriteria,
  type Page,
  type PageableRepository,
  type PageRequest,
  type PublicationCounter,
  type PublicationCounts,
} from "@/application/ports/list-criteria";
import type { OrderedContentRepository } from "@/application/ports/ordered-content-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { CommandNameConflictError } from "@/domain/command-name";
import type { TerminalCommand } from "@/domain/terminal-command";

import { prisma } from "../prisma/client";
import { LIVE, searchWhere, toPublicationCounts } from "./publication-filter";
import { toDomain, toPrismaCreate, toPrismaUpdate } from "./terminal-command.mapper";
import { PurgeableTrashPrismaRepository } from "./trashable-prisma.repository";

/** The command check in the use case is advisory; the unique index is what actually decides a race. */
function rethrowCommandCollision(error: unknown, command: TerminalCommand): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new CommandNameConflictError("command", command.props.command, "command");
  }

  throw error;
}

const SEARCH_FIELDS = ["command", "description", "output"] as const;
// createdAt and id break ties so the list, the pages and the move use case agree on one total order.
const LIST_ORDER = [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] as const;

export class TerminalCommandPrismaRepository
  extends PurgeableTrashPrismaRepository<TerminalCommand, PrismaTerminalCommand>
  implements OrderedContentRepository<TerminalCommand>, PageableRepository<TerminalCommand>, PublicationCounter
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

  async countByStatus(): Promise<PublicationCounts> {
    // Typed on its own: as an argument, Prisma infers its generic error type from the parameter instead.
    const groups = await prisma.terminalCommand.groupBy({ by: ["isPublished"], where: LIVE, _count: { _all: true } });

    return toPublicationCounts(groups);
  }

  async listPage(criteria: ListCriteria, request: PageRequest): Promise<Page<TerminalCommand>> {
    const where = { ...LIVE, ...searchWhere(criteria.search, SEARCH_FIELDS) };

    return fetchPage(
      request,
      () => prisma.terminalCommand.count({ where }),
      async (take, skip) => (await prisma.terminalCommand.findMany({ where, orderBy: [...LIST_ORDER], take, skip })).map(toDomain),
    );
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
