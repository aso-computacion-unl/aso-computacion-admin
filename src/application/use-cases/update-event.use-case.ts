import type { UpdateEventInput } from "@/domain/event";

import type { EventResult } from "../dto/event-result.dto";
import { toEventResult } from "../mappers/event-result.mapper";
import type { EventRepository } from "../ports/event-repository.port";
import { resolveEventSlug } from "./resolve-event-slug";
import { NotFoundError } from "./use-case-error";

export type UpdateEventCommand = UpdateEventInput & { id: string };

export class UpdateEventUseCase {
  constructor(private readonly events: EventRepository) {}

  async execute({ id, ...updates }: UpdateEventCommand): Promise<EventResult> {
    const event = await this.events.getById(id);

    if (!event) {
      throw new NotFoundError("Event not found");
    }

    // The slug only changes when the caller asks for it; the title alone never rewrites a public URL.
    if (updates.slug !== undefined && updates.slug !== event.props.slug) {
      await resolveEventSlug(this.events, event.props.title, updates.slug, id);
    }

    return toEventResult(await this.events.update(event.update(updates)));
  }
}
