import { NewsItem, type CreateNewsItemInput } from "@/domain/news-item";

import type { NewsItemResult } from "../dto/news-item-result.dto";
import { toNewsItemResult } from "../mappers/news-item-result.mapper";
import type { NewsRepository } from "../ports/news-repository.port";
import { withSlugIssue } from "./with-slug-issue";
import { resolveNewsSlug } from "./resolve-news-slug";

/** The cover is added afterwards with `SetNewsCoverUseCase`, once the item has an id. */
export type CreateNewsItemCommand = Pick<CreateNewsItemInput, "title" | "summary" | "body" | "slug" | "publishedAt" | "isPublished" | "publishAt" | "unpublishAt">;

export class CreateNewsItemUseCase {
  constructor(private readonly news: NewsRepository) {}

  async execute(command: CreateNewsItemCommand): Promise<NewsItemResult> {
    const item = await withSlugIssue(
      () => resolveNewsSlug(this.news, command.title, command.slug),
      command.slug,
      (slug) => NewsItem.create({ ...command, slug }),
    );
    const created = await this.news.create(item);

    return toNewsItemResult(created);
  }
}
