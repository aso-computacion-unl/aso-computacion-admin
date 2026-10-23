import type { NewsItemResult } from "../dto/news-item-result.dto";
import { toNewsItemResult } from "../mappers/news-item-result.mapper";
import type { MediaStoragePort } from "../ports/media-storage.port";
import type { NewsRepository } from "../ports/news-repository.port";
import { destroyStoredImages } from "./destroy-stored-images";
import { NotFoundError } from "./use-case-error";

/**
 * Clears the cover, then destroys the stored file best effort (logging the
 * `publicId` when that fails). An item without a cover is left as it is.
 */
export class RemoveNewsCoverUseCase {
  constructor(
    private readonly news: NewsRepository,
    private readonly storage: MediaStoragePort,
  ) {}

  async execute({ id }: { id: string }): Promise<NewsItemResult> {
    const item = await this.news.getById(id);

    if (!item) {
      throw new NotFoundError("News item not found");
    }

    const removed = item.props.cover?.publicId;

    if (!removed) {
      return toNewsItemResult(item);
    }

    const saved = await this.news.update(item.withoutCover());

    await destroyStoredImages(this.storage, [removed], `Removed the cover of news item "${id}"`);

    return toNewsItemResult(saved);
  }
}
