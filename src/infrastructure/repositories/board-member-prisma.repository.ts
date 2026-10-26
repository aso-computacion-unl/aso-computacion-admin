import "server-only";
import type { BoardMember as PrismaBoardMember } from "@prisma/client";

import type { OrderedContentRepository } from "@/application/ports/ordered-content-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import type { BoardMember } from "@/domain/board-member";

import { prisma } from "../prisma/client";
import { toDomain, toPrismaCreate, toPrismaUpdate } from "./board-member.mapper";
import { PurgeableTrashPrismaRepository } from "./trashable-prisma.repository";

export class BoardMemberPrismaRepository
  extends PurgeableTrashPrismaRepository<BoardMember, PrismaBoardMember>
  implements OrderedContentRepository<BoardMember>
{
  protected readonly delegate = prisma.boardMember;
  protected readonly trashConfig = {
    notFound: "Board member not found",
    toDomain,
    toUpdate: toPrismaUpdate,
  };

  async create(member: BoardMember): Promise<BoardMember> {
    return toDomain(await prisma.boardMember.create({ data: toPrismaCreate(member) }));
  }

  async getById(id: string): Promise<BoardMember | null> {
    const record = await prisma.boardMember.findUnique({ where: { id, deletedAt: null } });

    return record ? toDomain(record) : null;
  }

  async list(): Promise<BoardMember[]> {
    // createdAt and id break ties so the list and the move use case agree on the order.
    const records = await prisma.boardMember.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] });

    return records.map(toDomain);
  }

  async update(member: BoardMember): Promise<BoardMember> {
    const [record] = await prisma.boardMember.updateManyAndReturn({ where: { id: member.props.id, deletedAt: null }, data: toPrismaUpdate(member) });

    if (!record) {
      throw new NotFoundError("Board member not found");
    }

    return toDomain(record);
  }

  async saveOrder(orderedIds: readonly string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const [sortOrder, id] of orderedIds.entries()) {
        const { count } = await tx.boardMember.updateMany({ where: { id, deletedAt: null }, data: { sortOrder, updatedAt: new Date() } });

        if (count === 0) {
          throw new NotFoundError("Board member not found");
        }
      }
    });
  }
}
