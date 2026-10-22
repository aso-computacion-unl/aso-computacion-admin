import type { BoardMemberResult } from "./board-member-result.dto";
import type { EventPhotoResult, EventResult } from "./event-result.dto";
import type { FaqResult } from "./faq-result.dto";
import type { PillarResult } from "./pillar-result.dto";
import type { SiteSettingsResult } from "./site-settings-result.dto";
import type { SocialLinkResult } from "./social-link-result.dto";

/**
 * Everything the landing build reads, published items only and in display
 * order. Still the internal result shapes: the interface layer decides which
 * keys leave the building (`src/interface/public`).
 */
export interface PublicContentSnapshot {
  events: Array<EventResult & { photos: EventPhotoResult[] }>;
  faqs: FaqResult[];
  pillars: PillarResult[];
  socials: SocialLinkResult[];
  board: BoardMemberResult[];
  /** `null` until the settings are first saved: the landing then keeps its own fallback copy. */
  settings: SiteSettingsResult | null;
}
