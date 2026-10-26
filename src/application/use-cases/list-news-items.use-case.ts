import type { NewsItemResult } from "../dto/news-item-result.dto";
import { toNewsItemResult } from "../mappers/news-item-result.mapper";
import type { ListCriteria } from "../ports/list-criteria";
import type { NewsRepository } from "../ports/news-repository.port";

/** Admin listing: every item, drafts included unless the criteria narrows it, newest publication date first. */
export class ListNewsItemsUseCase {
  constructor(private readonly news: NewsRepository) {}

  async execute(criteria: ListCriteria = {}): Promise<NewsItemResult[]> {
    return (await this.news.list(criteria)).map(toNewsItemResult);
  }
}
