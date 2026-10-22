import type { Pillar } from "@/domain/pillar";

import type { MediaStoragePort } from "../ports/media-storage.port";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { destroyStoredImages } from "./destroy-stored-images";
import { NotFoundError } from "./use-case-error";

/**
 * Deletes the row, then destroys its stored image best effort (only after the
 * delete succeeded; a leftover `publicId` is logged, never an error).
 */
export class DeletePillarUseCase {
  constructor(
    private readonly pillars: OrderedContentRepository<Pillar>,
    private readonly storage: MediaStoragePort,
  ) {}

  async execute({ id }: { id: string }): Promise<void> {
    const pillar = await this.pillars.getById(id);

    if (!pillar) {
      throw new NotFoundError("Pillar not found");
    }

    await this.pillars.delete(id);

    if (pillar.props.image) {
      await destroyStoredImages(this.storage, [pillar.props.image.publicId], `Deleted pillar "${id}"`);
    }
  }
}
