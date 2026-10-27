import type { BoardMember } from "@/domain/board-member";
import type { Event } from "@/domain/event";
import type { Faq } from "@/domain/faq";
import type { ImpactStat } from "@/domain/impact-stat";
import type { NewsItem } from "@/domain/news-item";
import type { Pillar } from "@/domain/pillar";
import type { SocialLink } from "@/domain/social-link";
import type { Sponsor } from "@/domain/sponsor";
import type { TerminalCommand } from "@/domain/terminal-command";
import type { Testimonial } from "@/domain/testimonial";

import type { TrashItemResult, TrashKind } from "../dto/trash-result.dto";
import type { TrashableRepository } from "../ports/trashable-repository.port";

export interface TrashSources {
  events: TrashableRepository<Event>;
  news: TrashableRepository<NewsItem>;
  faqs: TrashableRepository<Faq>;
  commands: TrashableRepository<TerminalCommand>;
  socials: TrashableRepository<SocialLink>;
  pillars: TrashableRepository<Pillar>;
  board: TrashableRepository<BoardMember>;
  impact: TrashableRepository<ImpactStat>;
  testimonials: TrashableRepository<Testimonial>;
  sponsors: TrashableRepository<Sponsor>;
}

/** Everything in the trash, whatever its type, most recently deleted first. */
export class ListTrashUseCase {
  constructor(private readonly sources: TrashSources) {}

  async execute(): Promise<TrashItemResult[]> {
    const { events, news, faqs, commands, socials, pillars, board, impact, testimonials, sponsors } = this.sources;
    const read = async <E extends { props: { id: string } }>(repository: TrashableRepository<E>, kind: TrashKind, titleOf: (entity: E) => string) =>
      (await repository.listTrashed()).map(({ entity, deletedAt }): TrashItemResult => ({ kind, id: entity.props.id, title: titleOf(entity), deletedAt }));
    const groups = await Promise.all([
      read(events, "event", (event) => event.props.title),
      read(news, "news", (item) => item.props.title),
      read(faqs, "faq", (faq) => faq.props.question),
      read(commands, "command", (command) => command.props.command),
      read(socials, "social", (link) => link.props.label),
      read(pillars, "pillar", (pillar) => pillar.props.title),
      read(board, "board", (member) => member.props.name),
      read(impact, "impact", (stat) => `${stat.props.value} ${stat.props.label}`),
      read(testimonials, "testimonial", (item) => item.props.name),
      read(sponsors, "sponsor", (item) => item.props.name),
    ]);

    return groups.flat().sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
  }
}
