import { crossedWindowBetween } from "@/domain/publication-window";

import type { EventRepository } from "../ports/event-repository.port";
import type { NewsRepository } from "../ports/news-repository.port";
import type { LastBuildMarker, SiteRebuildTrigger } from "../ports/site-rebuild.port";

export interface WindowCrossingResult {
  /** Published events and news whose window opened or closed after the landing was last built. */
  crossed: number;
  outcome: "not-needed" | "triggered" | "disabled" | "failed";
}

/**
 * The landing is static, so an item scheduled for 08:00 only appears (or disappears) when the landing is
 * rebuilt after that moment. Run on a schedule, this asks for exactly one rebuild when at least one published
 * item crossed a window boundary since the last accepted rebuild, and asks for nothing otherwise, so an idle
 * site costs no builds. Drafts and trashed items are not on the site either way, so they never count.
 */
export class RebuildOnWindowCrossingUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly news: NewsRepository,
    private readonly lastBuild: LastBuildMarker,
    private readonly rebuild: SiteRebuildTrigger,
  ) {}

  async execute(now: Date): Promise<WindowCrossingResult> {
    const [since, events, news] = await Promise.all([this.lastBuild.lastSuccessAt(), this.events.list(), this.news.list()]);
    const crossed = [...events, ...news].filter((item) => crossedWindowBetween(item.props, since, now)).length;

    if (crossed === 0) {
      return { crossed, outcome: "not-needed" };
    }

    const result = await this.rebuild.trigger();

    return { crossed, outcome: result === "accepted" ? "triggered" : result };
  }
}
