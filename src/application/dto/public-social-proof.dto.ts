import type { SponsorResult } from "./sponsor-result.dto";

/**
 * The social proof the landing build reads: published, non-trashed sponsors in
 * display order. Still the internal result shape: the interface layer decides
 * which keys leave the building (`src/interface/public`).
 */
export interface PublicSocialProofSnapshot {
  sponsors: SponsorResult[];
}
