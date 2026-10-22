import { SocialLink, type CreateSocialLinkInput } from "@/domain/social-link";

import type { SocialLinkResult } from "../dto/social-link-result.dto";
import { toSocialLinkResult } from "../mappers/social-link-result.mapper";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { nextSortOrder } from "./ordered-content.use-cases";

export type CreateSocialLinkCommand = Omit<CreateSocialLinkInput, "sortOrder">;

/** New links go to the end of the list; ordering is changed with move up/down. */
export class CreateSocialLinkUseCase {
  constructor(private readonly links: OrderedContentRepository<SocialLink>) {}

  async execute(command: CreateSocialLinkCommand): Promise<SocialLinkResult> {
    const sortOrder = nextSortOrder(await this.links.list());

    return toSocialLinkResult(await this.links.create(SocialLink.create({ ...command, sortOrder })));
  }
}
