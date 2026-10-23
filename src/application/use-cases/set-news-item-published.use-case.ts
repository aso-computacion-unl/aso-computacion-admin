import type { NewsItemResult } from "../dto/news-item-result.dto";
import { toNewsItemResult } from "../mappers/news-item-result.mapper";
import type { NewsRepository } from "../ports/news-repository.port";
import { NotFoundError } from "./use-case-error";

export interface SetNewsItemPublishedCommand {
  id: string;
  isPublished: boolean;
}

/** Publish and unpublish are the same transition; only the flag differs. */
export class SetNewsItemPublishedUseCase {
  constructor(private readonly news: NewsRepository) {}

  async execute({ id, isPublished }: SetNewsItemPublishedCommand): Promise<NewsItemResult> {
    const item = await this.news.getById(id);

    if (!item) {
      throw new NotFoundError("News item not found");
    }

    return toNewsItemResult(await this.news.update(item.withPublished(isPublished)));
  }
}
