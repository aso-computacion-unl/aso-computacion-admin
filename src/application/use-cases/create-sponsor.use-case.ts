import { Sponsor, type CreateSponsorInput } from "@/domain/sponsor";

import type { SponsorResult } from "../dto/sponsor-result.dto";
import { toSponsorResult } from "../mappers/sponsor-result.mapper";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { nextSortOrder } from "./ordered-content.use-cases";

export type CreateSponsorCommand = Pick<CreateSponsorInput, "name" | "url" | "isPublished">;

/**
 * New sponsors go to the end of the list, without a logo: the logo is added
 * afterwards with `SetSponsorLogoUseCase`, once the sponsor has an id. A
 * sponsor cannot be published until then, so `isPublished: true` is refused.
 */
export class CreateSponsorUseCase {
  constructor(private readonly sponsors: OrderedContentRepository<Sponsor>) {}

  async execute({ name, url, isPublished }: CreateSponsorCommand): Promise<SponsorResult> {
    const sortOrder = nextSortOrder(await this.sponsors.list());

    return toSponsorResult(await this.sponsors.create(Sponsor.create({ name, url, isPublished, sortOrder })));
  }
}
