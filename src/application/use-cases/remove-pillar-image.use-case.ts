import type { Pillar } from "@/domain/pillar";

import type { PillarResult } from "../dto/pillar-result.dto";
import { toPillarResult } from "../mappers/pillar-result.mapper";
import type { MediaStoragePort } from "../ports/media-storage.port";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { destroyStoredImages } from "./destroy-stored-images";
import { NotFoundError } from "./use-case-error";

/**
 * Clears the image, then destroys the stored file best effort (logging the
 * `publicId` when that fails). A pillar without an image is left as it is.
 */
export class RemovePillarImageUseCase {
  constructor(
    private readonly pillars: OrderedContentRepository<Pillar>,
    private readonly storage: MediaStoragePort,
  ) {}

  async execute({ id }: { id: string }): Promise<PillarResult> {
    const pillar = await this.pillars.getById(id);

    if (!pillar) {
      throw new NotFoundError("Pillar not found");
    }

    const removed = pillar.props.image?.publicId;

    if (!removed) {
      return toPillarResult(pillar);
    }

    const saved = await this.pillars.update(pillar.withoutImage());

    await destroyStoredImages(this.storage, [removed], `Removed the image of pillar "${id}"`);

    return toPillarResult(saved);
  }
}
