import type { BulkKind } from "./bulk-input";
import { getBoardMemberUseCases } from "../board/board-members-container";
import { getCommandUseCases } from "../commands/commands-container";
import { getEventUseCases } from "../events/events-container";
import { getFaqUseCases } from "../faqs/faqs-container";
import { getNewsUseCases } from "../news/news-container";
import { getPillarUseCases } from "../pillars/pillars-container";
import { getSocialLinkUseCases } from "../socials/socials-container";
import { getSponsorUseCases } from "../sponsors/sponsors-container";

/** The two single-item use cases a bulk action repeats, whatever the kind. */
export interface BulkTarget {
  setPublished: { execute(command: { id: string; isPublished: boolean }): Promise<unknown> };
  trash: { execute(command: { id: string }): Promise<{ wasPublished: boolean }> };
}

/** Resolved per call, so a build that only imports the actions needs no database or storage credentials. */
export function getBulkTarget(kind: BulkKind): BulkTarget {
  switch (kind) {
    case "event":
      return getEventUseCases();
    case "news":
      return getNewsUseCases();
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
    case "sponsor":
      return getSponsorUseCases();
  }
}
