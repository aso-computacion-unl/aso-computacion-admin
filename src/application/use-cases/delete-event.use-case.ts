import type { EventPhotoRepository } from "../ports/event-photo-repository.port";
import type { EventRepository } from "../ports/event-repository.port";
import type { MediaStoragePort } from "../ports/media-storage.port";
import { NotFoundError } from "./use-case-error";

export interface DeleteEventCommand {
  id: string;
}

/**
 * Removes the event and (by cascade) its photo rows, then destroys every
 * stored image those rows pointed to, active or not. Deleting is explicit and
 * confirmed, unlike deactivating a photo, so nothing is kept for later.
 *
 * Storage cleanup runs only after the delete succeeded and is best effort:
 * the delete is never reported as failed because of it, and every `publicId`
 * that could not be destroyed is logged so it can be removed by hand.
 */
export class DeleteEventUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly photos: EventPhotoRepository,
    private readonly storage: MediaStoragePort,
  ) {}

  async execute({ id }: DeleteEventCommand): Promise<void> {
    if (!(await this.events.getById(id))) {
      throw new NotFoundError("Event not found");
    }

    const publicIds = await this.photos.listPublicIdsByEventId(id);

    await this.events.delete(id);
    await this.destroyAll(id, publicIds);
  }

  private async destroyAll(eventId: string, publicIds: readonly string[]): Promise<void> {
    const outcomes = await Promise.allSettled(publicIds.map((publicId) => this.storage.destroy(publicId)));
    const leftover = publicIds.filter((_, index) => outcomes[index]?.status === "rejected");

    if (leftover.length > 0) {
      const reasons = outcomes.flatMap((outcome) => (outcome.status === "rejected" ? [outcome.reason] : []));
      console.error(
        `Deleted event "${eventId}" but could not destroy its stored images: ${leftover.join(", ")}`,
        reasons,
      );
    }
  }
}
