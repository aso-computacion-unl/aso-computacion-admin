import type { Sponsor, UpdateSponsorInput } from "@/domain/sponsor";

import type { SponsorResult } from "../dto/sponsor-result.dto";
import { toSponsorResult } from "../mappers/sponsor-result.mapper";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { NotFoundError } from "./use-case-error";
import type { Updated } from "./updated-result";

export type UpdateSponsorCommand = UpdateSponsorInput & { id: string };

/** Name, link, publish flag and the alt of the current logo. Adding, replacing or removing the logo has its own use cases. */
export class UpdateSponsorUseCase {
  constructor(private readonly sponsors: OrderedContentRepository<Sponsor>) {}

  async execute({ id, ...updates }: UpdateSponsorCommand): Promise<Updated<SponsorResult>> {
    const sponsor = await this.sponsors.getById(id);

    if (!sponsor) {
      throw new NotFoundError("Sponsor not found");
    }

    return { ...toSponsorResult(await this.sponsors.update(sponsor.update(updates))), wasPublished: sponsor.props.isPublished };
  }
}
