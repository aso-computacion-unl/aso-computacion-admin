import type { CancelOutcome, EventRegistrationRepository } from "../ports/event-registration-repository.port";
import type { EventRepository } from "../ports/event-repository.port";
import type { ForumMemberRepository } from "../ports/forum.ports";
import { UnlMemberGuard, type UnlRegistrationConfig } from "./unl-member-guard";

/*
 * Cancelling a registration (D7): the person says they cannot attend and the registration is deleted, which frees the
 * seat and removes their data. Two ways in, both answering with the repository's atomic outcome and never saying
 * anything about registrations other than the one the caller already proved is theirs.
 */

/**
 * The person opened the cancellation link of their email and pressed the button. The link names an event and a
 * registration; it only counts on the event page it was issued for. Possession of a signed link is the proof, so the
 * answer may say "already cancelled" (`not_registered`): it tells nothing to anyone without a link we signed.
 */
export class CancelRegistrationByLinkUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly registrations: EventRegistrationRepository,
  ) {}

  async execute({ slug, eventId, registrationId, now = new Date() }: { slug: string; eventId: string; registrationId: string; now?: Date }): Promise<CancelOutcome | { status: "invalid" }> {
    const event = await this.events.findLiveBySlug(slug);

    if (!event) {
      return { status: "not_found" };
    }

    return event.props.id === eventId ? this.registrations.cancel(eventId, { id: registrationId }, now) : { status: "invalid" };
  }
}

/**
 * A signed-in UNL student cancels their own reservation from the event page. The registration is found by the verified
 * institutional address of the signed-in member, never by anything the caller sends, so no one can cancel (or learn
 * about) another person's: a member who is not registered just hears they are not.
 */
export class CancelUnlRegistrationUseCase {
  private readonly guard: UnlMemberGuard;

  constructor(
    private readonly events: EventRepository,
    private readonly registrations: EventRegistrationRepository,
    members: ForumMemberRepository,
    config: UnlRegistrationConfig,
  ) {
    this.guard = new UnlMemberGuard(members, config);
  }

  async execute({ slug, memberId, now = new Date() }: { slug: string; memberId: string; now?: Date }): Promise<CancelOutcome> {
    const { email } = await this.guard.identify(memberId);
    const event = await this.events.findLiveBySlug(slug);

    if (!event) {
      return { status: "not_found" };
    }

    return this.registrations.cancel(event.props.id, { email }, now);
  }
}
