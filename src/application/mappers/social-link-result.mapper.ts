import type { SocialLink } from "@/domain/social-link";

import type { SocialLinkResult } from "../dto/social-link-result.dto";

export function toSocialLinkResult(link: SocialLink): SocialLinkResult {
  return { ...link.props };
}
