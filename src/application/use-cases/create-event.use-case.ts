import { Event, type CreateEventInput } from "@/domain/event";

import type { EventResult } from "../dto/event-result.dto";
import { toEventResult } from "../mappers/event-result.mapper";
import type { EventRepository } from "../ports/event-repository.port";
import { withSlugIssue } from "./with-slug-issue";
import { resolveEventSlug } from "./resolve-event-slug";

/** The registration settings: only the Inscripciones use cases set them (S3), never an event save. */
export type EventRegistrationField = "registrationMode" | "registrationCapacity" | "registrationDeadline";

/** A new event starts without registration. */
export type CreateEventCommand = Omit<CreateEventInput, EventRegistrationField>;

export class CreateEventUseCase {
  constructor(private readonly events: EventRepository) {}

  async execute(command: CreateEventCommand): Promise<EventResult> {
    const event = await withSlugIssue(
      () => resolveEventSlug(this.events, command.title, command.slug),
      command.slug,
      (slug) => Event.create({ ...command, slug }),
    );
    const created = await this.events.create(event);

    return toEventResult(created);
  }
}
