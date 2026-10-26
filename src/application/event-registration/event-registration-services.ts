import type { EventRegistrationRepository } from "../ports/event-registration-repository.port";
import type { EventRepository } from "../ports/event-repository.port";
import type { ForumMemberRepository } from "../ports/forum.ports";
import { GetPublicEventUseCase } from "../use-cases/get-public-event.use-case";
import {
  DeleteEventRegistrationUseCase,
  GetEventRegistrationStatusUseCase,
  ListEventRegistrationsUseCase,
  RegisterWithOpenFormUseCase,
  RegisterWithUnlAccountUseCase,
  type UnlRegistrationConfig,
} from "./event-registration.use-cases";

export interface EventRegistrationRepositories {
  events: EventRepository;
  registrations: EventRegistrationRepository;
  members: ForumMemberRepository;
}

/** Wires every registration use case over the given repositories: the container passes Prisma ones, tests pass in-memory ones. */
export function buildEventRegistrationServices({ events, registrations, members }: EventRegistrationRepositories, unl: UnlRegistrationConfig) {
  return {
    status: new GetEventRegistrationStatusUseCase(events, registrations),
    registerOpen: new RegisterWithOpenFormUseCase(events, registrations),
    registerUnl: new RegisterWithUnlAccountUseCase(events, registrations, members, unl),
    list: new ListEventRegistrationsUseCase(events, registrations),
    remove: new DeleteEventRegistrationUseCase(registrations),
    publicEvent: new GetPublicEventUseCase(events),
  };
}

export type EventRegistrationServices = ReturnType<typeof buildEventRegistrationServices>;
