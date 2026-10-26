import "server-only";

import type { OrderedContentRepository } from "@/application/ports/ordered-content-repository.port";
import type { TrashedItem } from "@/application/ports/trashable-repository.port";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import type { BoardMember } from "@/domain/board-member";

import { prisma } from "../prisma/client";
import { toDomain, toPrismaCreate, toPrismaUpdate } from "./board-member.mapper";
import { LIVE } from "./publication-filter";
import { toTrashedItem, TRASH_ORDER, TRASHED } from "./trash";

export class BoardMemberPrismaRepository implements OrderedContentRepository<BoardMember> {
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

  async delete(id: string): Promise<void> {
    const { count } = await prisma.boardMember.deleteMany({ where: { id } });

    if (count === 0) {
      throw new NotFoundError("Board member not found");
    }
  }

  async trash(id: string): Promise<void> {
    const { count } = await prisma.boardMember.updateMany({
      where: { id, ...LIVE },
      data: { deletedAt: new Date(), isPublished: false },
    });

    if (count === 0) {
      throw new NotFoundError("Board member not found");
    }
  }

  async getTrashed(id: string): Promise<TrashedItem<BoardMember> | null> {
    const record = await prisma.boardMember.findFirst({ where: { id, ...TRASHED } });

    return record ? toTrashedItem(toDomain(record), record.deletedAt) : null;
  }

  async listTrashed(): Promise<TrashedItem<BoardMember>[]> {
    const records = await prisma.boardMember.findMany({ where: TRASHED, orderBy: [...TRASH_ORDER] });

    return records.map((record) => toTrashedItem(toDomain(record), record.deletedAt));
  }

  async restore(member: BoardMember): Promise<BoardMember> {
    const [record] = await prisma.boardMember.updateManyAndReturn({
      where: { id: member.props.id, ...TRASHED },
      data: { ...toPrismaUpdate(member), deletedAt: null },
    });

    if (!record) {
      throw new NotFoundError("Board member not found");
    }

    return toDomain(record);
  }

  async purge(id: string): Promise<void> {
    const { count } = await prisma.boardMember.deleteMany({ where: { id, ...TRASHED } });

    if (count === 0) {
      throw new NotFoundError("Board member not found");
    }
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
