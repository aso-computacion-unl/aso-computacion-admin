import { assertNewsCoverAlt, type NewsItem } from "@/domain/news-item";

import type { NewsItemResult } from "../dto/news-item-result.dto";
import { toNewsItemResult } from "../mappers/news-item-result.mapper";
import type { ImageUploadFile, MediaStoragePort } from "../ports/media-storage.port";
import type { NewsRepository } from "../ports/news-repository.port";
import { destroyStoredImages } from "./destroy-stored-images";
import { NotFoundError } from "./use-case-error";
import type { UploadImageUseCase } from "./upload-image.use-case";

export const NEWS_COVER_FOLDER = "news";
export const NEWS_COVER_MIN_WIDTH = 1200;

export interface SetNewsCoverCommand {
  id: string;
  file: ImageUploadFile;
  alt: string;
}

/**
 * Adds or replaces a news item's cover.
 *
 * What can be checked without storage (alt text, the item exists) is checked
 * BEFORE the upload. The DB write comes last: when it fails, the new asset is
 * nobody's, so it is destroyed (best effort, logged) and the original error is
 * rethrown. When it succeeds, the replaced cover is destroyed best effort,
 * logging any `publicId` left behind, same rule as deleting an event.
 */
export class SetNewsCoverUseCase {
  constructor(
    private readonly news: NewsRepository,
    private readonly uploadImage: UploadImageUseCase,
    private readonly storage: MediaStoragePort,
  ) {}

  async execute({ id, file, alt }: SetNewsCoverCommand): Promise<NewsItemResult> {
    const validAlt = assertNewsCoverAlt(alt);
    const item = await this.news.getById(id);

    if (!item) {
      throw new NotFoundError("News item not found");
    }

    const asset = await this.uploadImage.execute({ file, folder: NEWS_COVER_FOLDER, minWidth: NEWS_COVER_MIN_WIDTH });

    let saved: NewsItem;

    try {
      saved = await this.news.update(item.withCover({ ...asset, alt: validAlt }));
    } catch (error) {
      await destroyStoredImages(this.storage, [asset.publicId], `Could not save news item "${id}" after uploading its cover`);
      throw error;
    }

    const replaced = item.props.cover?.publicId;

    if (replaced) {
      await destroyStoredImages(this.storage, [replaced], `Replaced the cover of news item "${id}"`);
    }

    return toNewsItemResult(saved);
  }
}
