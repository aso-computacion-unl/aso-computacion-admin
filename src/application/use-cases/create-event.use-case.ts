import { Event, type CreateEventInput } from "@/domain/event";

import type { EventResult } from "../dto/event-result.dto";
import { toEventResult } from "../mappers/event-result.mapper";
import type { EventRepository } from "../ports/event-repository.port";
import { resolveEventSlug } from "./resolve-event-slug";

export type CreateEventCommand = CreateEventInput;

export class CreateEventUseCase {
  constructor(private readonly events: EventRepository) {}

  async execute(command: CreateEventCommand): Promise<EventResult> {
    const slug = await resolveEventSlug(this.events, command.title, command.slug);
    const created = await this.events.create(Event.create({ ...command, slug }));

    return toEventResult(created);
  }
}
