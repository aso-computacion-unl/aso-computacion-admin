import type { Sponsor } from "@/domain/sponsor";

import type { SponsorResult } from "../dto/sponsor-result.dto";

export function toSponsorResult({ props }: Sponsor): SponsorResult {
  const { logo } = props;

  return {
    id: props.id,
    name: props.name,
    logo: logo && { url: logo.url, width: logo.width, height: logo.height, alt: logo.alt },
    url: props.url,
    sortOrder: props.sortOrder,
    isPublished: props.isPublished,
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
  };
}
