import { NewsItem, type CreateNewsItemInput } from "@/domain/news-item";

import type { NewsItemResult } from "../dto/news-item-result.dto";
import { toNewsItemResult } from "../mappers/news-item-result.mapper";
import type { NewsRepository } from "../ports/news-repository.port";
import { resolveNewsSlug } from "./resolve-news-slug";

/** The cover is added afterwards with `SetNewsCoverUseCase`, once the item has an id. */
export type CreateNewsItemCommand = Pick<CreateNewsItemInput, "title" | "summary" | "body" | "slug" | "publishedAt" | "isPublished">;

export class CreateNewsItemUseCase {
  constructor(private readonly news: NewsRepository) {}

  async execute(command: CreateNewsItemCommand): Promise<NewsItemResult> {
    const slug = await resolveNewsSlug(this.news, command.title, command.slug);
    const created = await this.news.create(NewsItem.create({ ...command, slug }));

    return toNewsItemResult(created);
  }
}
