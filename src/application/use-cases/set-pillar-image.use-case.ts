import { assertPillarImageAlt, type Pillar } from "@/domain/pillar";

import type { PillarResult } from "../dto/pillar-result.dto";
import { toPillarResult } from "../mappers/pillar-result.mapper";
import type { ImageUploadFile, MediaStoragePort } from "../ports/media-storage.port";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { destroyStoredImages } from "./destroy-stored-images";
import { NotFoundError } from "./use-case-error";
import type { UploadImageUseCase } from "./upload-image.use-case";

export const PILLAR_IMAGE_FOLDER = "pillars";
export const PILLAR_IMAGE_MIN_WIDTH = 1200;

export interface SetPillarImageCommand {
  id: string;
  file: ImageUploadFile;
  alt: string;
}

/**
 * Adds or replaces a pillar's image.
 *
 * What can be checked without storage (alt text, the pillar exists) is checked
 * BEFORE the upload. The DB write comes last: when it fails, the new asset is
 * nobody's, so it is destroyed (best effort, logged) and the original error is
 * rethrown. When it succeeds, the replaced image is destroyed best effort,
 * logging any `publicId` left behind, same rule as deleting an event.
 */
export class SetPillarImageUseCase {
  constructor(
    private readonly pillars: OrderedContentRepository<Pillar>,
    private readonly uploadImage: UploadImageUseCase,
    private readonly storage: MediaStoragePort,
  ) {}

  async execute({ id, file, alt }: SetPillarImageCommand): Promise<PillarResult> {
    const validAlt = assertPillarImageAlt(alt);
    const pillar = await this.pillars.getById(id);

    if (!pillar) {
      throw new NotFoundError("Pillar not found");
    }

    const asset = await this.uploadImage.execute({
      file,
      folder: PILLAR_IMAGE_FOLDER,
      minWidth: PILLAR_IMAGE_MIN_WIDTH,
    });

    let saved: Pillar;

    try {
      saved = await this.pillars.update(pillar.withImage({ ...asset, alt: validAlt }));
    } catch (error) {
      await destroyStoredImages(this.storage, [asset.publicId], `Could not save pillar "${id}" after uploading its image`);
      throw error;
    }

    const replaced = pillar.props.image?.publicId;

    if (replaced) {
      await destroyStoredImages(this.storage, [replaced], `Replaced the image of pillar "${id}"`);
    }

    return toPillarResult(saved);
  }
}
