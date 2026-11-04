import "server-only";
import { Prisma, type Faq as PrismaFaq } from "@/generated/prisma/client";

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
import type { Faq } from "@/domain/faq";

import { prisma } from "../prisma/client";
import { LIVE, searchWhere, toPublicationCounts } from "./publication-filter";
import { toDomain, toPrismaCreate, toPrismaUpdate } from "./faq.mapper";
import { PurgeableTrashPrismaRepository } from "./trashable-prisma.repository";

/** The command check in the use case is advisory; the unique index is what actually decides a race. */
function rethrowCommandCollision(error: unknown, faq: Faq): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && faq.props.command) {
    throw new CommandNameConflictError("command", faq.props.command, "faq");
  }

  throw error;
}

const SEARCH_FIELDS = ["question", "answer", "command"] as const;
// createdAt and id break ties so the list, the pages and the move use case agree on one total order.
const LIST_ORDER = [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] as const;

export class FaqPrismaRepository
  extends PurgeableTrashPrismaRepository<Faq, PrismaFaq>
  implements OrderedContentRepository<Faq>, PageableRepository<Faq>, PublicationCounter
{
  protected readonly delegate = prisma.faq;
  protected readonly trashConfig = {
    notFound: "Faq not found",
    toDomain,
    toUpdate: toPrismaUpdate,
    mapConflict: rethrowCommandCollision,
  };

  async create(faq: Faq): Promise<Faq> {
    try {
      return toDomain(await prisma.faq.create({ data: toPrismaCreate(faq) }));
    } catch (error) {
      return rethrowCommandCollision(error, faq);
    }
  }

  async getById(id: string): Promise<Faq | null> {
    const record = await prisma.faq.findUnique({ where: { id, deletedAt: null } });

    return record ? toDomain(record) : null;
  }

  async list(): Promise<Faq[]> {
    // createdAt and id break ties so the list and the move use case agree on the order.
    const records = await prisma.faq.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] });

    return records.map(toDomain);
  }

  async countByStatus(): Promise<PublicationCounts> {
    // Typed on its own: as an argument, Prisma infers its generic error type from the parameter instead.
    const groups = await prisma.faq.groupBy({ by: ["isPublished"], where: LIVE, _count: { _all: true } });

    return toPublicationCounts(groups);
  }

  async listPage(criteria: ListCriteria, request: PageRequest): Promise<Page<Faq>> {
    const where = { ...LIVE, ...searchWhere(criteria.search, SEARCH_FIELDS) };

    return fetchPage(
      request,
      () => prisma.faq.count({ where }),
      async (take, skip) => (await prisma.faq.findMany({ where, orderBy: [...LIST_ORDER], take, skip })).map(toDomain),
    );
  }

  async update(faq: Faq): Promise<Faq> {
    let record;

    try {
      [record] = await prisma.faq.updateManyAndReturn({ where: { id: faq.props.id, deletedAt: null }, data: toPrismaUpdate(faq) });
    } catch (error) {
      return rethrowCommandCollision(error, faq);
    }

    if (!record) {
      throw new NotFoundError("Faq not found");
    }

    return toDomain(record);
  }

  async saveOrder(orderedIds: readonly string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const [sortOrder, id] of orderedIds.entries()) {
        const { count } = await tx.faq.updateMany({ where: { id, deletedAt: null }, data: { sortOrder, updatedAt: new Date() } });

        if (count === 0) {
          throw new NotFoundError("Faq not found");
        }
      }
    });
  }
}
