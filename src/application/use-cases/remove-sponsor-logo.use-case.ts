import type { Sponsor } from "@/domain/sponsor";

import type { SponsorResult } from "../dto/sponsor-result.dto";
import { toSponsorResult } from "../mappers/sponsor-result.mapper";
import type { MediaStoragePort } from "../ports/media-storage.port";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { destroyStoredImages } from "./destroy-stored-images";
import { NotFoundError } from "./use-case-error";

/**
 * Clears the logo (and unpublishes the sponsor, who cannot show without one),
 * then destroys the stored file best effort, logging the `publicId` when that
 * fails. A sponsor without a logo is left as it is.
 */
export class RemoveSponsorLogoUseCase {
  constructor(
    private readonly sponsors: OrderedContentRepository<Sponsor>,
    private readonly storage: MediaStoragePort,
  ) {}

  async execute({ id }: { id: string }): Promise<SponsorResult> {
    const sponsor = await this.sponsors.getById(id);

    if (!sponsor) {
      throw new NotFoundError("Sponsor not found");
    }

    const removed = sponsor.props.logo?.publicId;

    if (!removed) {
      return toSponsorResult(sponsor);
    }

    const saved = await this.sponsors.update(sponsor.withoutLogo());

    await destroyStoredImages(this.storage, [removed], `Removed the logo of sponsor "${id}"`);

    return toSponsorResult(saved);
  }
}
