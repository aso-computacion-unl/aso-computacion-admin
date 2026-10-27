import type { ImpactStatResult } from "./impact-stat-result.dto";
import type { SponsorResult } from "./sponsor-result.dto";
import type { TestimonialResult } from "./testimonial-result.dto";

/**
 * The social proof the landing build reads (S9): published, non-trashed items
 * in display order. Still the internal result shapes: the interface layer
 * decides which keys leave the building (`src/interface/public`).
 */
export interface PublicSocialProofSnapshot {
  impact: ImpactStatResult[];
  testimonials: TestimonialResult[];
  sponsors: SponsorResult[];
}
