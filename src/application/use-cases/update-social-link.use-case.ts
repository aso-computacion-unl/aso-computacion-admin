import type { SocialLink, UpdateSocialLinkInput } from "@/domain/social-link";

import type { SocialLinkResult } from "../dto/social-link-result.dto";
import { toSocialLinkResult } from "../mappers/social-link-result.mapper";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { NotFoundError } from "./use-case-error";

export type UpdateSocialLinkCommand = UpdateSocialLinkInput & { id: string };

export class UpdateSocialLinkUseCase {
  constructor(private readonly links: OrderedContentRepository<SocialLink>) {}

  async execute({ id, ...updates }: UpdateSocialLinkCommand): Promise<SocialLinkResult> {
    const link = await this.links.getById(id);

    if (!link) {
      throw new NotFoundError("Social link not found");
    }

    return toSocialLinkResult(await this.links.update(link.update(updates)));
  }
}
