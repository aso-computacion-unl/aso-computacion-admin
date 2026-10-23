import type { NewsItemResult } from "../dto/news-item-result.dto";
import { toNewsItemResult } from "../mappers/news-item-result.mapper";
import type { NewsRepository } from "../ports/news-repository.port";
import { NotFoundError } from "./use-case-error";

export class GetNewsItemUseCase {
  constructor(private readonly news: NewsRepository) {}

  async execute({ id }: { id: string }): Promise<NewsItemResult> {
    const item = await this.news.getById(id);

    if (!item) {
      throw new NotFoundError("News item not found");
    }

    return toNewsItemResult(item);
  }
}
