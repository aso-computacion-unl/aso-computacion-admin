import "server-only";

import { Prisma, type ForumCategory as ForumCategoryRow } from "@/generated/prisma/client";

import type { ForumCategoryDeleteOutcome, ForumCategoryRepository, ForumCategoryWithCount } from "@/application/ports/forum.ports";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import type { ForumCategory } from "@/domain/forum";

import { prisma } from "../prisma/client";

const toCategory = (row: ForumCategoryRow): ForumCategory => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description,
  sortOrder: row.sortOrder,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const isKnownError = (error: unknown, code: string): boolean => error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

export class ForumCategoryPrismaRepository implements ForumCategoryRepository {
  async list(): Promise<ForumCategoryWithCount[]> {
    const rows = await prisma.forumCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      include: { _count: { select: { threads: { where: { hiddenAt: null } } } } },
    });

    return rows.map(({ _count, ...row }) => ({ category: toCategory(row), threadCount: _count.threads }));
  }

  async findById(id: string): Promise<ForumCategory | null> {
    const row = await prisma.forumCategory.findUnique({ where: { id } });

    return row && toCategory(row);
  }

  async findBySlug(slug: string): Promise<ForumCategory | null> {
    const row = await prisma.forumCategory.findUnique({ where: { slug } });

    return row && toCategory(row);
  }

  async nextSortOrder(): Promise<number> {
    const { _max } = await prisma.forumCategory.aggregate({ _max: { sortOrder: true } });

    return (_max.sortOrder ?? 0) + 1;
  }

  async create(category: ForumCategory): Promise<boolean> {
    try {
      await prisma.forumCategory.create({ data: category });
      return true;
    } catch (error) {
      if (isKnownError(error, "P2002")) {
        return false;
      }

      throw error;
    }
  }

  async update(category: ForumCategory): Promise<boolean> {
    const { id, slug, name, description, sortOrder, updatedAt } = category;

    try {
      await prisma.forumCategory.update({ where: { id }, data: { slug, name, description, sortOrder, updatedAt } });
      return true;
    } catch (error) {
      if (isKnownError(error, "P2002")) {
        return false;
      }

      if (isKnownError(error, "P2025")) {
        throw new NotFoundError("Forum category not found");
      }

      throw error;
    }
  }

  async delete(id: string): Promise<ForumCategoryDeleteOutcome> {
    try {
      await prisma.forumCategory.delete({ where: { id } });
      return "ok";
    } catch (error) {
      // The foreign key refuses a category that still has threads: nothing is deleted.
      if (isKnownError(error, "P2003")) {
        return "not-empty";
      }

      if (isKnownError(error, "P2025")) {
        return "not-found";
      }

      throw error;
    }
  }
}
