import type { BoardMember } from "@/domain/board-member";
import type { Faq } from "@/domain/faq";
import type { Pillar } from "@/domain/pillar";
import type { SocialLink } from "@/domain/social-link";
import type { TerminalCommand } from "@/domain/terminal-command";

import type { PublicContentSnapshot } from "../dto/public-content.dto";
import { toBoardMemberResult } from "../mappers/board-member-result.mapper";
import { toEventPhotoResult, toEventResult } from "../mappers/event-result.mapper";
import { toFaqResult } from "../mappers/faq-result.mapper";
import { toNewsItemResult } from "../mappers/news-item-result.mapper";
import { toPillarResult } from "../mappers/pillar-result.mapper";
import { toSiteSettingsResult } from "../mappers/site-settings-result.mapper";
import { toSocialLinkResult } from "../mappers/social-link-result.mapper";
import { toTerminalCommandResult } from "../mappers/terminal-command-result.mapper";
import type { EventPhotoRepository } from "../ports/event-photo-repository.port";
import type { EventRepository } from "../ports/event-repository.port";
import type { NewsRepository } from "../ports/news-repository.port";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import type { SiteSettingsRepository } from "../ports/site-settings-repository.port";

/**
 * Read-only snapshot for the landing build: published items only, in the order
 * the admin set (events: date descending, undated last; news: publication date descending). Read-only by
 * construction: it only calls list/get methods. The sets are small (dozens of
 * rows), so filtering after `list()` beats adding a second published-only
 * query to every port.
 */
export class GetPublicContentUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly eventPhotos: EventPhotoRepository,
    private readonly faqs: OrderedContentRepository<Faq>,
    private readonly pillars: OrderedContentRepository<Pillar>,
    private readonly socials: OrderedContentRepository<SocialLink>,
    private readonly board: OrderedContentRepository<BoardMember>,
    private readonly settings: SiteSettingsRepository,
    private readonly news: NewsRepository,
    private readonly commands: OrderedContentRepository<TerminalCommand>,
  ) {}

  async execute(): Promise<PublicContentSnapshot> {
    const [events, faqs, pillars, socials, board, settings, news, commands] = await Promise.all([
      this.events.list(),
      this.faqs.list(),
      this.pillars.list(),
      this.socials.list(),
      this.board.list(),
      this.settings.get(),
      this.news.list(),
      this.commands.list(),
    ]);
    const published = events.filter((event) => event.props.isPublished);
    const photos = await this.eventPhotos.listActiveByEventIds(published.map((event) => event.props.id));
    const isPublished = ({ props }: { props: { isPublished: boolean } }) => props.isPublished;

    return {
      events: published.map((event) => ({
        ...toEventResult(event),
        photos: (photos.get(event.props.id) ?? []).map(toEventPhotoResult),
      })),
      faqs: faqs.filter(isPublished).map(toFaqResult),
      pillars: pillars.filter(isPublished).map(toPillarResult),
      socials: socials.filter(isPublished).map(toSocialLinkResult),
      board: board.filter(isPublished).map(toBoardMemberResult),
      settings: settings && toSiteSettingsResult(settings),
      // `list()` already comes newest publication date first.
      news: news.filter(isPublished).map(toNewsItemResult),
      commands: commands.filter(isPublished).map(toTerminalCommandResult),
    };
  }
}
