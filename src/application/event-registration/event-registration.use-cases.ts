import type { EventResult } from "../dto/event-result.dto";
import { toEventResult } from "../mappers/event-result.mapper";
import type { EventRegistrationRecord, EventRegistrationRepository, RegisterOutcome } from "../ports/event-registration-repository.port";
import type { EventRepository } from "../ports/event-repository.port";
import type { ForumMemberRepository } from "../ports/forum.ports";
import { ForbiddenError, NotFoundError } from "../use-cases/use-case-error";
import { ForumMemberSuspendedError } from "@/domain/forum";
import {
  parseOpenRegistration,
  registrationRefusal,
  type RegistrationMode,
} from "@/domain/event-registration";
import { emailDomain, normalizeEmail } from "@/domain/user";
import { ValidationError } from "@/domain/domain-error";

type IdGenerator = () => string;

export type RegistrationState = "open" | "full" | "closed";

/** What the registration page and the landing need about one event: no personal data, only counts. */
export interface EventRegistrationStatus {
  event: Pick<EventResult, "slug" | "title" | "date" | "datePrecision" | "hora" | "lugar">;
  mode: RegistrationMode;
  state: RegistrationState;
  /** This person (by email) is already registered. */
  alreadyRegistered: boolean;
  capacity: number | null;
  deadline: Date | null;
}

/** The registration state of a public event, or null when it is not public or takes no registration. */
export class GetEventRegistrationStatusUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly registrations: EventRegistrationRepository,
  ) {}

  async execute({ slug, now, email }: { slug: string; now: Date; email?: string }): Promise<EventRegistrationStatus | null> {
    const found = await this.events.findLiveBySlug(slug);
    const mode = found?.props.registrationMode;

    if (!found || mode === undefined || mode === "none") {
      return null;
    }

    const event = found.props;
    const [registered, alreadyRegistered] = await Promise.all([
      this.registrations.count(event.id),
      email ? this.registrations.exists(event.id, email.trim().toLowerCase()) : false,
    ]);
    const refusal = registrationRefusal({ event, mode, registered, alreadyRegistered: false, now });

    if (refusal === "not_found") {
      return null;
    }

    return {
      event: { slug: event.slug, title: event.title, date: event.date, datePrecision: event.datePrecision, hora: event.hora, lugar: event.lugar },
      mode,
      state: refusal === "full" ? "full" : refusal === null ? "open" : "closed",
      alreadyRegistered,
      capacity: event.registrationCapacity,
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
    data: Pick<EventRegistrationRecord, "name" | "email" | "career" | "semester">,
  ): Promise<RegisterOutcome> {
    const event = await this.events.findLiveBySlug(slug);

    if (!event) {
      return { status: "not_found" };
    }

    return this.registrations.register({ id: this.newId(), eventId: event.props.id, mode, ...data }, now);
  }
}

export class RegisterWithOpenFormUseCase extends RegisterUseCase {
  async execute({ slug, form, now = new Date() }: { slug: string; form: Record<string, unknown>; now?: Date }): Promise<RegisterOutcome> {
    const { name, email, career, semester } = parseOpenRegistration(form);

    return this.store(slug, now, "open", { name, email, career, semester });
  }
}

export interface UnlRegistrationConfig {
  /** The institutional domain; unset or blank refuses every UNL registration (fail closed, like the forum login). */
  allowedDomain?: string;
}

/** A signed-in forum member registers with the verified name and email the forum already holds. */
export class RegisterWithUnlAccountUseCase extends RegisterUseCase {
  private readonly allowedDomain: string | undefined;

  constructor(
    events: EventRepository,
    registrations: EventRegistrationRepository,
    private readonly members: ForumMemberRepository,
    config: UnlRegistrationConfig,
    newId?: IdGenerator,
  ) {
    super(events, registrations, newId);
    this.allowedDomain = config.allowedDomain?.trim().replace(/^@/, "").toLowerCase() || undefined;
  }

  async execute({ slug, memberId, now = new Date() }: { slug: string; memberId: string; now?: Date }): Promise<RegisterOutcome> {
    const member = await this.members.findById(memberId);

    if (!this.allowedDomain || !member) {
      throw new ForbiddenError();
    }

    if (member.status !== "ACTIVE") {
      throw new ForumMemberSuspendedError();
    }

    const email = this.institutionalEmail(member.email);

    return this.store(slug, now, "unl", { name: member.displayName, email, career: null, semester: null });
  }

  private institutionalEmail(raw: string): string {
    try {
      const email = normalizeEmail(raw);

      if (emailDomain(email) === this.allowedDomain) {
        return email;
      }
    } catch (error) {
      if (!(error instanceof ValidationError)) {
        throw error;
      }
    }

    throw new ForbiddenError();
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

