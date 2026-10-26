import type { Event } from "@/domain/event";
import type { Faq } from "@/domain/faq";
import type { NewsItem } from "@/domain/news-item";
import type { TerminalCommand } from "@/domain/terminal-command";

import type { CommandNameRegistry } from "../ports/command-name-registry.port";
import type { EventRepository } from "../ports/event-repository.port";
import type { NewsRepository } from "../ports/news-repository.port";
import type { OrderedContent, OrderedContentRepository } from "../ports/ordered-content-repository.port";
import type { TrashableRepository } from "../ports/trashable-repository.port";
import { nextSortOrder } from "./ordered-content.use-cases";
import { NotFoundError, RestoreConflictError } from "./use-case-error";

/**
 * Brings a trashed item back. `prepare` decides the state it returns in and
 * throws, before anything is stored, when it cannot come back. A restored item
 * is always a draft (L11): publishing it again is a separate, deliberate step.
 */
export class RestoreContentUseCase<E> {
  constructor(
    private readonly repository: TrashableRepository<E>,
    private readonly notFoundMessage: string,
    private readonly prepare: (entity: E) => Promise<E>,
  ) {}

  async execute({ id }: { id: string }): Promise<void> {
    const trashed = await this.repository.getTrashed(id);

    if (!trashed) {
      throw new NotFoundError(this.notFoundMessage);
    }

    await this.repository.restore(await this.prepare(trashed.entity));
  }
}

/** Ordered lists: the item returns at the end, so its old position can never collide with a live one. */
export class RestoreOrderedContentUseCase<E extends OrderedContent<E>> extends RestoreContentUseCase<E> {
  constructor(repository: OrderedContentRepository<E>, notFoundMessage: string, check: (entity: E) => Promise<void> = async () => undefined) {
    super(repository, notFoundMessage, async (entity) => {
      await check(entity);

      return entity.withPublished(false).withSortOrder(nextSortOrder(await repository.list()));
    });
  }
}

async function assertCommandFree(registry: CommandNameRegistry, command: string | null): Promise<void> {
  const owner = command ? await registry.findOwner(command) : null;

  if (owner && command) {
    throw new RestoreConflictError("command", command, owner);
  }
}

export class RestoreFaqUseCase extends RestoreOrderedContentUseCase<Faq> {
  constructor(faqs: OrderedContentRepository<Faq>, registry: CommandNameRegistry) {
    super(faqs, "Faq not found", (faq) => assertCommandFree(registry, faq.props.command));
  }
}

export class RestoreTerminalCommandUseCase extends RestoreOrderedContentUseCase<TerminalCommand> {
  constructor(commands: OrderedContentRepository<TerminalCommand>, registry: CommandNameRegistry) {
    super(commands, "Terminal command not found", (command) => assertCommandFree(registry, command.props.command));
  }
}

export class RestoreEventUseCase extends RestoreContentUseCase<Event> {
  constructor(events: EventRepository) {
    super(events, "Event not found", async (event) => {
      if (await events.slugExists(event.props.slug)) {
        throw new RestoreConflictError("slug", event.props.slug, "event");
      }

      return event.update({ isPublished: false });
    });
  }
}

export class RestoreNewsItemUseCase extends RestoreContentUseCase<NewsItem> {
  constructor(news: NewsRepository) {
    super(news, "News item not found", async (item) => {
      if (await news.slugExists(item.props.slug)) {
        throw new RestoreConflictError("slug", item.props.slug, "news");
      }

      return item.withPublished(false);
    });
  }
}
