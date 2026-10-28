import type { Sponsor } from "@/domain/sponsor";

import type { PublicSocialProofSnapshot } from "../dto/public-social-proof.dto";
import { toSponsorResult } from "../mappers/sponsor-result.mapper";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";

/**
 * Read-only social proof for the landing build, next to `GetPublicContentUseCase`:
 * published items only, in the order the admin set. `list()` never returns a
 * trashed row, and the set is small, so filtering after it beats a second
 * published-only query on the port.
 */
export class GetPublicSocialProofUseCase {
  constructor(private readonly sponsors: OrderedContentRepository<Sponsor>) {}

  async execute(): Promise<PublicSocialProofSnapshot> {
    const sponsors = await this.sponsors.list();

    return { sponsors: sponsors.filter(({ props }) => props.isPublished).map(toSponsorResult) };
  }
}
