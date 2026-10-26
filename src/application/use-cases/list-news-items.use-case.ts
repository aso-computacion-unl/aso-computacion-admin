import type { NewsItemResult } from "../dto/news-item-result.dto";
import { toNewsItemResult } from "../mappers/news-item-result.mapper";
import type { ListCriteria, Page, PageRequest } from "../ports/list-criteria";
import type { NewsRepository } from "../ports/news-repository.port";

/** Admin listing: every item, drafts included unless the criteria narrows it, newest publication date first. */
export class ListNewsItemsUseCase {
  constructor(private readonly news: NewsRepository) {}

  async execute(criteria: ListCriteria = {}): Promise<NewsItemResult[]> {
    return (await this.news.list(criteria)).map(toNewsItemResult);
  }

  /** One page of the same listing. */
  async executePage(criteria: ListCriteria, request: PageRequest): Promise<Page<NewsItemResult>> {
    const page = await this.news.listPage(criteria, request);

    return { ...page, items: page.items.map(toNewsItemResult) };
  }
}
