import type { ForumActor } from "@/application";
import type { EventRegistrationStatus } from "@/application";
import { getEventRegistrationServices } from "@/interface/public/event-registration-container";

import { getForumMember } from "./require-forum-member";

export interface EventRegistrationPage {
  /** The signed-in member, or null: the page then offers the Google login. */
  member: ForumActor | null;
  status: EventRegistrationStatus;
}

/** What `/foro/eventos/[slug]` shows, or null (a 404) unless the event is public and asks for a UNL account. */
export async function getEventRegistrationPage(slug: string, now: Date = new Date()): Promise<EventRegistrationPage | null> {
  const member = await getForumMember();
  const status = await getEventRegistrationServices().status.execute({ slug, now, memberId: member?.memberId });

  return status && status.mode === "unl" ? { member, status } : null;
}
