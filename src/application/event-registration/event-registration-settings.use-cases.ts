import type { EventDatePrecision } from "@/domain/event";
import { PAST_EVENT_REGISTRATION_MESSAGE, REGISTRATION_ALREADY_SET_MESSAGE, type EventRegistrationMode } from "@/domain/event-registration";
import { isEventOver } from "@/domain/event-registration-retention";
import { ValidationError } from "@/domain/domain-error";

import type { EventResult } from "../dto/event-result.dto";
import { toEventResult } from "../mappers/event-result.mapper";
import type { EventRepository } from "../ports/event-repository.port";
import { NotFoundError } from "../use-cases/use-case-error";
import { soonestFirst } from "./soonest-first";

/** An event that can start taking registrations, as the admin's picker shows it. */
export interface RegistrationCandidate {
  id: string;
  title: string;
  date: string | null;
  datePrecision: EventDatePrecision;
  lugar: string | null;
  /** A draft can be prepared too: its registration shows on the site once it is published. */
  isPublished: boolean;
}

/** The registration settings a save sets on an event; `undefined` leaves a setting as it is. */
export interface EventRegistrationCommand {
  eventId: string;
  registrationMode?: EventRegistrationMode;
  registrationCapacity?: number | null;
  registrationDeadline?: Date | null;
}

/**
 * The events «Crear inscripción» can pick (S2): not over yet (the same rule as the registration overview), published
 * or drafts, that take no registration. Soonest first, undated last.
 */
export class ListRegistrationCandidatesUseCase {
  constructor(private readonly events: EventRepository) {}

  async execute({ now = new Date() }: { now?: Date } = {}): Promise<RegistrationCandidate[]> {
    return (await this.events.list())
      .map((event) => event.props)
      .filter((event) => event.registrationMode === "none" && !isEventOver(event, now))
      .map(({ id, title, date, datePrecision, lugar, isPublished }) => ({ id, title, date, datePrecision, lugar, isPublished }))
      .sort(soonestFirst);
  }
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
 * Turns on the registration of an event that has none (S1): the same eligibility as the picker, checked again here
 * because the id comes from the request. A save without a way to register opens nothing.
 */
export class OpenEventRegistrationUseCase {
  constructor(private readonly events: EventRepository) {}

  async execute(command: EventRegistrationCommand, now = new Date()): Promise<EventResult> {
    return saveSettings(this.events, command, (event) => {
      if (event.registrationMode !== "none") {
        throw new ValidationError("registrationMode", REGISTRATION_ALREADY_SET_MESSAGE);
      }

      if (isEventOver(event, now)) {
        throw new ValidationError("registrationMode", PAST_EVENT_REGISTRATION_MESSAGE);
      }

      if (command.registrationMode === undefined || command.registrationMode === "none") {
        throw new ValidationError("registrationMode", "registrationMode must be unl or open to open registration");
      }
    });
  }
}
