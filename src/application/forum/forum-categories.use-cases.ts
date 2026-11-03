import { ValidationError } from "@/domain/domain-error";
import { parseCategoryDescription, parseCategoryName, type ForumCategory } from "@/domain/forum";
import { assertSlug, slugify } from "@/domain/slug";

import type { ForumCategoryResult } from "../dto/forum-result.dto";
import type { ForumCategoryRepository } from "../ports/forum.ports";
import { NotFoundError } from "../use-cases/use-case-error";

type Clock = () => Date;

/** The category still has threads (hidden ones too), so deleting it would orphan or lose posts. */
export class ForumCategoryNotEmptyError extends Error {
  constructor() {
    super("The forum category still has threads");
    this.name = "ForumCategoryNotEmptyError";
  }
}

export function toForumCategoryResult(category: ForumCategory, threadCount: number): ForumCategoryResult {
  const { id, slug, name, description, sortOrder } = category;

  return { id, slug, name, description, sortOrder, threadCount };
}

function taken(): never {
  throw new ValidationError("slug", "slug is already used by another forum category");
}

function parseSortOrder(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 10000) {
    throw new ValidationError("sortOrder", "sortOrder must be an integer from 0 to 10000");
  }

  return value;
}

export class ListForumCategoriesUseCase {
  constructor(private readonly categories: ForumCategoryRepository) {}

  async execute(): Promise<ForumCategoryResult[]> {
    return (await this.categories.list()).map(({ category, threadCount }) => toForumCategoryResult(category, threadCount));
  }
}

export interface CreateForumCategoryCommand {
  name: string;
  description?: string | null;
  /** Derived from the name when omitted. */
  slug?: string;
}

export class CreateForumCategoryUseCase {
  constructor(
    private readonly categories: ForumCategoryRepository,
    private readonly now: Clock = () => new Date(),
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  async execute(command: CreateForumCategoryCommand): Promise<ForumCategoryResult> {
    const name = parseCategoryName(command.name);
    const slug = assertSlug(command.slug ?? slugify(name));
    const at = this.now();
    const category: ForumCategory = {
      id: this.newId(),
      slug,
      name,
      description: parseCategoryDescription(command.description),
      sortOrder: await this.categories.nextSortOrder(),
      createdAt: at,
      updatedAt: at,
    };

    if (!(await this.categories.create(category))) {
      taken();
    }

    return toForumCategoryResult(category, 0);
  }
}

export interface UpdateForumCategoryCommand {
  id: string;
  name?: string;
  /** `null` clears it. */
  description?: string | null;
  slug?: string;
  sortOrder?: number;
}

export class UpdateForumCategoryUseCase {
  constructor(
    private readonly categories: ForumCategoryRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(command: UpdateForumCategoryCommand): Promise<ForumCategoryResult> {
    const current = await this.categories.findById(command.id);

    if (!current) {
      throw new NotFoundError("Forum category not found");
    }

    const next: ForumCategory = {
      ...current,
      name: command.name === undefined ? current.name : parseCategoryName(command.name),
      description: command.description === undefined ? current.description : parseCategoryDescription(command.description),
      slug: command.slug === undefined ? current.slug : assertSlug(command.slug),
      sortOrder: command.sortOrder === undefined ? current.sortOrder : parseSortOrder(command.sortOrder),
      updatedAt: this.now(),
    };

    if (!(await this.categories.update(next))) {
      taken();
    }

    const threadCount = (await this.categories.list()).find((entry) => entry.category.id === next.id)?.threadCount ?? 0;

    return toForumCategoryResult(next, threadCount);
  }
}

export class DeleteForumCategoryUseCase {
  constructor(private readonly categories: ForumCategoryRepository) {}

  async execute(command: { id: string }): Promise<void> {
    const outcome = await this.categories.delete(command.id);

    if (outcome === "not-found") {
      throw new NotFoundError("Forum category not found");
    }

    if (outcome === "not-empty") {
      throw new ForumCategoryNotEmptyError();
    }
  }
}
