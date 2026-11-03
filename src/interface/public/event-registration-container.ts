import { buildEventRegistrationServices, type EventRegistrationServices } from "@/application";
import { EventPrismaRepository, EventRegistrationPrismaRepository, ForumMemberPrismaRepository } from "@/infrastructure";
import { forumAllowedDomain } from "@/infrastructure/forum/forum-config";

let services: EventRegistrationServices | undefined;

/** Built on first use, so importing a route or an action never opens a database connection. */
export function getEventRegistrationServices(): EventRegistrationServices {
  services ??= buildEventRegistrationServices(
    { events: new EventPrismaRepository(), registrations: new EventRegistrationPrismaRepository(), members: new ForumMemberPrismaRepository() },
    { allowedDomain: forumAllowedDomain() },
  );

  return services;
}
