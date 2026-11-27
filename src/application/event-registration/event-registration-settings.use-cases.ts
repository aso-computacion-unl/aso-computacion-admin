import { REGISTRATION_NOT_SET_MESSAGE, type EventRegistrationMode } from "@/domain/event-registration";
import { ValidationError } from "@/domain/domain-error";

import type { EventResult } from "../dto/event-result.dto";
import { toEventResult } from "../mappers/event-result.mapper";
import type { EventRepository } from "../ports/event-repository.port";
import { NotFoundError } from "../use-cases/use-case-error";

/** The registration settings a save sets on an event; `undefined` leaves a setting as it is. */
export interface EventRegistrationCommand {
  eventId: string;
  registrationMode?: EventRegistrationMode;
  registrationCapacity?: number | null;
  registrationDeadline?: Date | null;
}

/** Sets only the registration settings of the event, through the entity's own rules (S4 included). */
async function saveSettings(events: EventRepository, { eventId, registrationMode, registrationCapacity, registrationDeadline }: EventRegistrationCommand, check: (event: EventResult) => void = () => {}) {
  const event = await events.getById(eventId);

  if (!event) {
    throw new NotFoundError("Event not found");
  }

  check(toEventResult(event));

  return toEventResult(await events.update(event.update({ registrationMode, registrationCapacity, registrationDeadline })));
}

/**
 * Changes the registration of an event that has one, as stored: an event takes one only when it is created with it,
 * and never loses it (event-kinds S2, S6). The entity refuses what S4 refuses.
 */
export class ChangeEventRegistrationUseCase {
  constructor(private readonly events: EventRepository) {}

  async execute(command: EventRegistrationCommand): Promise<EventResult> {
    return saveSettings(this.events, command, (event) => {
      if (event.registrationMode === "none") {
        throw new ValidationError("registrationMode", REGISTRATION_NOT_SET_MESSAGE);
      }
    });
  }
}
