import type { PublicSocialProofSnapshot } from "@/application/dto/public-social-proof.dto";

import type { PublicImage } from "./public-content.dto";
import type { PublicSocialProof } from "./public-social-proof.dto";

// Built key by key, never spread: a field added to an entity later stays private until someone adds it here on purpose.
const toPublicImage = ({ url, width, height, alt }: PublicImage): PublicImage => ({ url, width, height, alt });

export function toPublicSocialProof(snapshot: PublicSocialProofSnapshot): PublicSocialProof {
  return {
    impact: snapshot.impact.map((stat) => ({ value: stat.value, label: stat.label })),
    testimonials: snapshot.testimonials.map((item) => ({
      quote: item.quote,
      name: item.name,
      role: item.role,
      photo: item.photo && toPublicImage(item.photo),
    })),
    // A published sponsor always has a logo (domain rule and DB CHECK); the flatMap keeps the landing's type honest even if that invariant were ever broken.
    sponsors: snapshot.sponsors.flatMap((item) => (item.logo ? [{ name: item.name, logo: toPublicImage(item.logo), url: item.url }] : [])),
  };
}
