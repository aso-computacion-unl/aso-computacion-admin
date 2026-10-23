import type { SocialPlatform } from "@/domain/social-link";

/** Plain shape returned by social link use cases; mirrors `SocialLinkProps` without exposing the entity. */
export interface SocialLinkResult {
  id: string;
  platform: SocialPlatform;
  label: string;
  handle: string;
  url: string;
  note: string | null;
  blurb: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}
