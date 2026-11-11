import type { EventResult } from "../dto/event-result.dto";
import { toEventResult } from "../mappers/event-result.mapper";
import type { ConfirmOutcome, EventRegistrationRecord, EventRegistrationRepository, RegisterOutcome } from "../ports/event-registration-repository.port";
import type { EventRepository } from "../ports/event-repository.port";
import type { ForumMemberRepository } from "../ports/forum.ports";
import { NotFoundError } from "../use-cases/use-case-error";
import { UnlMemberGuard, type UnlRegistrationConfig } from "./unl-member-guard";
import {
  parseOpenRegistration,
  registrationRefusal,
  type RegistrationMode,
  type RegistrationState,
} from "@/domain/event-registration";

type IdGenerator = () => string;

export type { RegistrationState };

/** What the registration page and the landing need about one event: no personal data, only counts. */
export interface EventRegistrationStatus {
  event: Pick<EventResult, "slug" | "title" | "description" | "date" | "datePrecision" | "hora" | "lugar">;
  mode: RegistrationMode;
  state: RegistrationState;
  /** This person (by email) is already registered. */
  alreadyRegistered: boolean;
  capacity: number | null;
  /** People registered so far: with `capacity`, the seats left. */
  registered: number;
  deadline: Date | null;
}

/** The registration state of a public event, or null when it is not public or takes no registration. */
export class GetEventRegistrationStatusUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly registrations: EventRegistrationRepository,
    private readonly members?: ForumMemberRepository,
  ) {}

  /** `memberId` (a forum member) is a way to say "this person" without handing their email to the caller. */
  async execute({ slug, now, email, memberId }: { slug: string; now: Date; email?: string; memberId?: string }): Promise<EventRegistrationStatus | null> {
    const found = await this.events.findLiveBySlug(slug);
    const mode = found?.props.registrationMode;

    if (!found || mode === undefined || mode === "none") {
      return null;
    }

    const event = found.props;
    const person = email ?? (memberId ? (await this.members?.findById(memberId))?.email : undefined);
    const [registered, alreadyRegistered] = await Promise.all([
      this.registrations.count(event.id),
      person ? this.registrations.exists(event.id, person.trim().toLowerCase()) : false,
    ]);
    const refusal = registrationRefusal({ event, mode, registered, alreadyRegistered: false, now });

    if (refusal === "not_found") {
      return null;
    }

    return {
      event: { slug: event.slug, title: event.title, description: event.description, date: event.date, datePrecision: event.datePrecision, hora: event.hora, lugar: event.lugar },
      mode,
      state: refusal === "full" ? "full" : refusal === null ? "open" : "closed",
      alreadyRegistered,
      capacity: event.registrationCapacity,
      registered,
      deadline: event.registrationDeadline,
    };
  }
}

/** Shared by both ways of registering: resolves the slug, builds the row and lets the repository decide atomically. */
abstract class RegisterUseCase {
  constructor(
    protected readonly events: EventRepository,
    protected readonly registrations: EventRegistrationRepository,
    private readonly newId: IdGenerator = () => crypto.randomUUID(),
  ) {}

  protected async store(
    slug: string,
    now: Date,
    mode: RegistrationMode,
    data: Pick<EventRegistrationRecord, "name" | "email" | "institution" | "career" | "semester" | "confirmedAt"> & { confirmNonce?: string | null },
  ): Promise<RegisterOutcome> {
    const event = await this.events.findLiveBySlug(slug);

    if (!event) {
      return { status: "not_found" };
    }

    return this.registrations.register({ id: this.newId(), eventId: event.props.id, mode, ...data }, now);
  }
}

export class RegisterWithOpenFormUseCase extends RegisterUseCase {
  /**
   * `confirmNonce` is the attempt the caller is about to put in the confirmation link: it replaces the one a pending row
   * of the same email held, so the link of the earlier attempt stops working (D9).
   */
  async execute({ slug, form, now = new Date(), confirmNonce }: { slug: string; form: Record<string, unknown>; now?: Date; confirmNonce?: string }): Promise<RegisterOutcome> {
    const { name, email, institution, career, semester } = parseOpenRegistration(form);

    // Pending until the person opens the link sent to that address: an unverified email takes no seat.
    return this.store(slug, now, "open", { name, email, institution, career, semester, confirmedAt: null, confirmNonce });
  }
}

/**
 * The person opened the link of their confirmation email and pressed the button. The link names an event and a
 * registration (and the attempt it was issued for); it only counts on the event page it was issued for. The seat itself
 * is decided by the repository, atomically, so a full or closed event refuses here even though the email was perfectly valid.
 */
export class ConfirmOpenRegistrationUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly registrations: EventRegistrationRepository,
  ) {}

  /** `nonce`: the attempt the link names, `null` for a link that names none. Required so no caller can skip the check. */
  async execute({ slug, eventId, registrationId, nonce, now = new Date() }: { slug: string; eventId: string; registrationId: string; nonce: string | null; now?: Date }): Promise<ConfirmOutcome> {
    const event = await this.events.findLiveBySlug(slug);

    if (!event) {
      return { status: "not_found" };
    }

    return event.props.id === eventId ? this.registrations.confirm(eventId, registrationId, now, nonce) : { status: "invalid" };
  }
}

export type { UnlRegistrationConfig };

/** A signed-in forum member registers with the verified name and email the forum already holds. */
export class RegisterWithUnlAccountUseCase extends RegisterUseCase {
  private readonly guard: UnlMemberGuard;

  constructor(
    events: EventRepository,
    registrations: EventRegistrationRepository,
    members: ForumMemberRepository,
    config: UnlRegistrationConfig,
    newId?: IdGenerator,
  ) {
    super(events, registrations, newId);
    this.guard = new UnlMemberGuard(members, config);
  }

  async execute({ slug, memberId, now = new Date() }: { slug: string; memberId: string; now?: Date }): Promise<RegisterOutcome> {
    const { name, email } = await this.guard.identify(memberId);

    // Google already verified this address: the seat is taken at once.
    return this.store(slug, now, "unl", { name, email, institution: null, career: null, semester: null, confirmedAt: now });
  }
}

export class ListEventRegistrationsUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly registrations: EventRegistrationRepository,
  ) {}

  async execute({ eventId }: { eventId: string }): Promise<{ event: EventResult; registrations: EventRegistrationRecord[] }> {
    const event = await this.events.getById(eventId);

    if (!event) {
      throw new NotFoundError("Event not found");
    }

    return { event: toEventResult(event), registrations: await this.registrations.list(eventId) };
  }
}

export class DeleteEventRegistrationUseCase {
  constructor(private readonly registrations: EventRegistrationRepository) {}

  async execute({ eventId, registrationId }: { eventId: string; registrationId: string }): Promise<void> {
    if (!(await this.registrations.delete(eventId, registrationId))) {
      throw new NotFoundError("Registration not found");
    }
  }
}

