import type { EventRepository } from "../ports/event-repository.port";
import { NotFoundError } from "./use-case-error";

export interface DeleteEventCommand {
  id: string;
}

/**
 * Removes the event and (by cascade) its photo rows. The images stay in
 * storage on purpose: nothing is destroyed as a side effect, same retention
 * rule as deactivating a photo.
 */
export class DeleteEventUseCase {
  constructor(private readonly events: EventRepository) {}

  async execute({ id }: DeleteEventCommand): Promise<void> {
    if (!(await this.events.getById(id))) {
      throw new NotFoundError("Event not found");
    }

    await this.events.delete(id);
  }
}
