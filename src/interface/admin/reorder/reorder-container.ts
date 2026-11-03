import type { ReorderKind } from "./reorder-input";
import { getBoardMemberUseCases } from "../board/board-members-container";
import { getCommandUseCases } from "../commands/commands-container";
import { getFaqUseCases } from "../faqs/faqs-container";
import { getImpactStatUseCases } from "../impact/impact-container";
import { getPillarUseCases } from "../pillars/pillars-container";
import { getSocialLinkUseCases } from "../socials/socials-container";
import { getSponsorUseCases } from "../sponsors/sponsors-container";
import { getTestimonialUseCases } from "../testimonials/testimonials-container";

export interface ReorderTarget {
  reorder: { execute(command: { id: string; position: number }): Promise<void> };
}

/** Resolved per call, so a build that only imports the action needs no database or storage credentials. */
export function getReorderTarget(kind: ReorderKind): ReorderTarget {
  switch (kind) {
    case "faq":
      return getFaqUseCases();
    case "command":
      return getCommandUseCases();
    case "social":
      return getSocialLinkUseCases();
    case "pillar":
      return getPillarUseCases();
    case "board":
      return getBoardMemberUseCases();
    case "impact":
      return getImpactStatUseCases();
    case "testimonial":
      return getTestimonialUseCases();
    case "sponsor":
      return getSponsorUseCases();
  }
}
