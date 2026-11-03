import { buildEventRegistrationServices } from "@/application";
import { Event, type CreateEventInput } from "@/domain/event";
import { InMemoryEventRegistrationRepository } from "@/tests/fakes/in-memory-event-registration.repository";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";

import { FORUM_TEST_DOMAIN, testForum } from "./test-forum";

const events = new InMemoryEventRepository();
const registrations = new InMemoryEventRegistrationRepository(events);

/**
 * The event registration services every unit test sees instead of the Prisma-backed container (installed for
 * all tests by `auth-doubles.setup.ts`): the real use cases over in-memory repositories, sharing the forum's
 * in-memory members so a forum sign-in is also a registrable person.
 */
export const testEventRegistration = {
  events,
  registrations,
  services: buildEventRegistrationServices({ events, registrations, members: testForum.members }, { allowedDomain: FORUM_TEST_DOMAIN }),
};

export function resetTestEventRegistration(): void {
  events.clear();
  registrations.clear();
}

/** A published event that takes registrations, stored in the shared double. */
export async function addTestEvent(overrides: Partial<CreateEventInput> = {}) {
  const event = Event.create({ title: "Taller de Git", date: "2099-11-28", isPublished: true, registrationMode: "open", ...overrides });

  await events.create(event);

  return event.props;
}
