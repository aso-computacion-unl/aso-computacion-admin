import type { ImpactStat } from "@/domain/impact-stat";
import type { Sponsor } from "@/domain/sponsor";
import type { Testimonial } from "@/domain/testimonial";

import type { PublicSocialProofSnapshot } from "../dto/public-social-proof.dto";
import { toImpactStatResult } from "../mappers/impact-stat-result.mapper";
import { toSponsorResult } from "../mappers/sponsor-result.mapper";
import { toTestimonialResult } from "../mappers/testimonial-result.mapper";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";

/**
 * Read-only social proof for the landing build, next to `GetPublicContentUseCase`:
 * published items only, in the order the admin set. `list()` never returns a
 * trashed row, and the sets are small, so filtering after it beats a second
 * published-only query on every port.
 */
export class GetPublicSocialProofUseCase {
  constructor(
    private readonly impact: OrderedContentRepository<ImpactStat>,
    private readonly testimonials: OrderedContentRepository<Testimonial>,
    private readonly sponsors: OrderedContentRepository<Sponsor>,
  ) {}

  async execute(): Promise<PublicSocialProofSnapshot> {
    const [impact, testimonials, sponsors] = await Promise.all([this.impact.list(), this.testimonials.list(), this.sponsors.list()]);
    const isPublished = ({ props }: { props: { isPublished: boolean } }) => props.isPublished;

    return {
      impact: impact.filter(isPublished).map(toImpactStatResult),
      testimonials: testimonials.filter(isPublished).map(toTestimonialResult),
      sponsors: sponsors.filter(isPublished).map(toSponsorResult),
    };
  }
}
