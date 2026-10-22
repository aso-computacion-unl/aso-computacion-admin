import type { EventRepository } from "../ports/event-repository.port";
import type { MediaStoragePort } from "../ports/media-storage.port";

export interface DeleteEventCommand {
  id: string;
}

/**
 * Removes the event and (by cascade) its photo rows, then destroys every
 * stored image those rows pointed to, active or not. Deleting is explicit and
 * confirmed, unlike deactivating a photo, so nothing is kept for later.
 *
 * The ids to destroy come from the delete itself, read in its transaction
 * under a lock on the event, so a photo attached while the delete is running
 * cannot be missed (reading them first, then deleting, left that gap).
 *
 * Storage cleanup runs only after the delete committed and is best effort:
 * the delete is never reported as failed because of it, and every `publicId`
 * that could not be destroyed is logged so it can be removed by hand.
 */
export class DeleteEventUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly storage: MediaStoragePort,
  ) {}

  async execute({ id }: DeleteEventCommand): Promise<void> {
    const publicIds = await this.events.delete(id);

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
