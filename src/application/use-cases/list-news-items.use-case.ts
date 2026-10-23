import type { NewsItemResult } from "../dto/news-item-result.dto";
import { toNewsItemResult } from "../mappers/news-item-result.mapper";
import type { NewsRepository } from "../ports/news-repository.port";

/** Admin listing: every item, drafts included, newest publication date first. */
export class ListNewsItemsUseCase {
  constructor(private readonly news: NewsRepository) {}

  async execute(): Promise<NewsItemResult[]> {
    return (await this.news.list()).map(toNewsItemResult);
  }
}
