import type { EventResult } from "../dto/event-result.dto";
import { toEventResult } from "../mappers/event-result.mapper";
import type { EventRepository } from "../ports/event-repository.port";
import { NotFoundError } from "./use-case-error";

export interface SetEventPublishedCommand {
  id: string;
  isPublished: boolean;
}

/** Publish and unpublish are the same transition; only the flag differs. */
export class SetEventPublishedUseCase {
  constructor(private readonly events: EventRepository) {}

  async execute({ id, isPublished }: SetEventPublishedCommand): Promise<EventResult> {
    const event = await this.events.getById(id);

    if (!event) {
      throw new NotFoundError("Event not found");
    }

    return toEventResult(await this.events.update(event.update({ isPublished })));
  }
}
