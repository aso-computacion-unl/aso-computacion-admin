import type { MediaStoragePort } from "../ports/media-storage.port";
import type { NewsRepository } from "../ports/news-repository.port";
import { destroyStoredImages } from "./destroy-stored-images";
import { NotFoundError } from "./use-case-error";

/**
 * Deletes the row, then destroys its stored cover best effort (only after the
 * delete succeeded; a leftover `publicId` is logged, never an error).
 */
export class DeleteNewsItemUseCase {
  constructor(
    private readonly news: NewsRepository,
    private readonly storage: MediaStoragePort,
  ) {}

  async execute({ id }: { id: string }): Promise<void> {
    const item = await this.news.getById(id);

    if (!item) {
      throw new NotFoundError("News item not found");
    }

    await this.news.delete(id);

    if (item.props.cover) {
      await destroyStoredImages(this.storage, [item.props.cover.publicId], `Deleted news item "${id}"`);
    }
  }
}
