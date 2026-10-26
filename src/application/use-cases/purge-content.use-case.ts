import type { BoardMember } from "@/domain/board-member";
import type { NewsItem } from "@/domain/news-item";
import type { Pillar } from "@/domain/pillar";

import type { EventRepository } from "../ports/event-repository.port";
import type { MediaStoragePort } from "../ports/media-storage.port";
import type { NewsRepository } from "../ports/news-repository.port";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import type { TrashableRepository } from "../ports/trashable-repository.port";
import { destroyStoredImages } from "./destroy-stored-images";
import { NotFoundError } from "./use-case-error";

export interface PurgeCleanup<E> {
  storage: MediaStoragePort;
  /** Names the item in the log line when an image cannot be destroyed. */
  label: string;
  publicIdsOf: (entity: E) => readonly string[];
}

/**
 * Permanent delete, for items that are already in the trash and nowhere else:
 * a live item is refused. Stored images are destroyed only after the row is
 * gone, best effort (a leftover `publicId` is logged, never an error).
 */
export class PurgeContentUseCase<E> {
  constructor(
    private readonly repository: Pick<TrashableRepository<E>, "getTrashed"> & { purge(id: string): Promise<void> },
    private readonly notFoundMessage: string,
    private readonly cleanup?: PurgeCleanup<E>,
  ) {}

  async execute({ id }: { id: string }): Promise<void> {
    const trashed = await this.repository.getTrashed(id);

    if (!trashed) {
      throw new NotFoundError(this.notFoundMessage);
    }

    await this.repository.purge(id);

    if (this.cleanup) {
      await destroyStoredImages(this.cleanup.storage, this.cleanup.publicIdsOf(trashed.entity), `Purged ${this.cleanup.label} "${id}"`);
    }
  }
}

export class PurgePillarUseCase extends PurgeContentUseCase<Pillar> {
  constructor(pillars: OrderedContentRepository<Pillar>, storage: MediaStoragePort) {
    super(pillars, "Pillar not found", { storage, label: "pillar", publicIdsOf: (pillar) => (pillar.props.image ? [pillar.props.image.publicId] : []) });
  }
}

export class PurgeBoardMemberUseCase extends PurgeContentUseCase<BoardMember> {
  constructor(members: OrderedContentRepository<BoardMember>, storage: MediaStoragePort) {
    super(members, "Board member not found", { storage, label: "board member", publicIdsOf: (member) => (member.props.photo ? [member.props.photo.publicId] : []) });
  }
}

export class PurgeNewsItemUseCase extends PurgeContentUseCase<NewsItem> {
  constructor(news: NewsRepository, storage: MediaStoragePort) {
    super(news, "News item not found", { storage, label: "news item", publicIdsOf: (item) => (item.props.cover ? [item.props.cover.publicId] : []) });
  }
}

/**
 * Removes a trashed event with its photo rows, then destroys every stored image
 * those rows pointed to, active or not. The ids come from the purge itself, read
 * in its transaction under a lock on the event, so none can be missed.
 */
export class PurgeEventUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly storage: MediaStoragePort,
  ) {}

  async execute({ id }: { id: string }): Promise<void> {
    const publicIds = await this.events.purge(id);

    await destroyStoredImages(this.storage, publicIds, `Purged event "${id}"`);
  }
}
