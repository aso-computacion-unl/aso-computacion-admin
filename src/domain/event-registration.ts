import { todayInEcuador } from "./calendar-date";
import { ValidationError } from "./domain-error";
import { isPubliclyVisible } from "./publication-window";
import { normalizeEmail } from "./user";

/** `none`: no registration. `unl`: a verified institutional Google account (the forum's). `open`: a public form. */
export const EVENT_REGISTRATION_MODES = ["none", "unl", "open"] as const;
export type EventRegistrationMode = (typeof EVENT_REGISTRATION_MODES)[number];

/** How a registration was made: never `none`. */
export type RegistrationMode = Exclude<EventRegistrationMode, "none">;

export const EVENT_REGISTRATION_CAPACITY_MAX = 5000;
export const REGISTRATION_NAME_MAX_LENGTH = 120;
export const REGISTRATION_CAREER_MAX_LENGTH = 120;
export const REGISTRATION_INSTITUTION_MAX_LENGTH = 120;
/** An open-form registration waits this long for its email to be confirmed; until then it takes no seat. */
export const REGISTRATION_CONFIRMATION_TTL_MS = 48 * 60 * 60 * 1000;
export const REGISTRATION_SEMESTER_MAX = 12;
/** The cancellation link of an email works this long after it was issued: a registration is purged 90 days after its event, so a year outlasts any link that still has something to cancel. */
export const REGISTRATION_CANCEL_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export interface RegistrationSettings {
  readonly mode: EventRegistrationMode;
  /** `null`: unlimited. */
  readonly capacity: number | null;
  /** Registration closes at this instant (exclusive); `null`: it closes with the event day. */
  readonly deadline: Date | null;
}

/** Capacity and deadline only mean something while the event takes registrations, so `none` clears them. */
export function assertRegistrationSettings(
  mode: string | undefined,
  capacity: number | null | undefined,
  deadline: Date | null | undefined,
): RegistrationSettings {
  const value = mode ?? "none";

  if (!(EVENT_REGISTRATION_MODES as readonly string[]).includes(value)) {
    throw new ValidationError("registrationMode", `registrationMode must be one of: ${EVENT_REGISTRATION_MODES.join(", ")}`);
  }

  if (value === "none") {
    return { mode: "none", capacity: null, deadline: null };
  }

  if (capacity !== null && capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1 || capacity > EVENT_REGISTRATION_CAPACITY_MAX)) {
    throw new ValidationError("registrationCapacity", `registrationCapacity must be a whole number from 1 to ${EVENT_REGISTRATION_CAPACITY_MAX}`);
  }

  if (deadline !== null && deadline !== undefined && Number.isNaN(deadline.getTime())) {
    throw new ValidationError("registrationDeadline", "registrationDeadline must be a valid date and time");
  }

  return { mode: value as EventRegistrationMode, capacity: capacity ?? null, deadline: deadline ?? null };
}

/** What an admin's save changes for the people who already registered: the mode they signed up through, or the seats left for them. */
export type RegistrationChangeImpact = "mode" | "seats";

export interface RegistrationChangeInput {
  /** People registered and confirmed: a pending one holds no seat and is nobody's to warn about. */
  registered: number;
  current: { mode: EventRegistrationMode; capacity: number | null };
  /** What the form sent; `undefined` for a setting it did not send, which the save leaves as it is. */
  next: { mode?: EventRegistrationMode; capacity?: number | null };
}

/**
 * The changes of a save that need the admin's confirmation (D14), in the order the warning tells them. None while no
 * one is registered. A mode change always counts (the registered people signed up through the old one). Seats count
 * when the save sets a limit below the registered people that is lower than the one in force: keeping or raising a
 * limit that is already below them, or lifting it, warns about nothing. Switching registration off clears the limit,
 * so it is only a mode change.
 */
export function registrationChangeImpacts({ registered, current, next }: RegistrationChangeInput): RegistrationChangeImpact[] {
  if (registered <= 0) {
    return [];
  }

  const mode = next.mode ?? current.mode;
  const capacity = mode === "none" ? null : next.capacity === undefined ? current.capacity : next.capacity;
  const impacts: RegistrationChangeImpact[] = [];

  if (mode !== current.mode) {
    impacts.push("mode");
  }

  if (capacity !== null && capacity < registered && (current.capacity === null || capacity < current.capacity)) {
    impacts.push("seats");
  }

  return impacts;
}

/** The slice of an event the rules read. */
export interface RegistrableEvent {
  readonly isPublished: boolean;
  readonly publishAt: Date | null;
  readonly unpublishAt: Date | null;
  readonly date: string | null;
  readonly datePrecision: "day" | "month";
  readonly registrationMode: EventRegistrationMode;
  readonly registrationCapacity: number | null;
  readonly registrationDeadline: Date | null;
}

export type RegistrationRefusal = "not_found" | "mode_mismatch" | "closed" | "full" | "duplicate";

/** Pending rows stored at or before this instant can no longer be confirmed: they hold a stranger's data for nothing. */
export function pendingPurgeCutoff(now: Date): Date {
  return new Date(now.getTime() - REGISTRATION_CONFIRMATION_TTL_MS);
}

/** A pending registration whose confirmation window has run out: its link no longer confirms anything. */
export function isConfirmationExpired(pendingSince: Date, now: Date): boolean {
  return now.getTime() - pendingSince.getTime() >= REGISTRATION_CONFIRMATION_TTL_MS;
}

/** The deadline instant has passed, or the event day is before today in Ecuador (a month-only or missing date never closes). */
function isClosed(event: RegistrableEvent, now: Date): boolean {
  if (event.registrationDeadline && now.getTime() >= event.registrationDeadline.getTime()) {
    return true;
  }

  return event.date !== null && event.datePrecision === "day" && event.date < todayInEcuador(now);
}

export type RegistrationState = "open" | "full" | "closed";

/**
 * Where an event stands for registration, whoever is asking: closed (deadline or past day) wins over full, the
 * same order `registrationRefusal` applies. It ignores visibility and mode: callers decide which events to ask about.
 */
export function registrationState(event: RegistrableEvent, registered: number, now: Date): RegistrationState {
  if (isClosed(event, now)) {
    return "closed";
  }

  return event.registrationCapacity !== null && registered >= event.registrationCapacity ? "full" : "open";
}

export type CancellationRefusal = "not_found" | "closed";

/**
 * Whether a registration of this event can still be cancelled (D7): the event is public, and registration has not
 * closed (deadline or day passed; after that the organizers are told by the person, not by the page). Neither the
 * mode nor the seats matter: someone who registered the old way, or on a full event, can still let the seat go.
 * Who is cancelling, and that the registration exists, are decided elsewhere.
 */
export function cancellationRefusal({ event, now }: { event: RegistrableEvent; now: Date }): CancellationRefusal | null {
  if (!isPubliclyVisible(event, now)) {
    return "not_found";
  }

  return isClosed(event, now) ? "closed" : null;
}

export interface RegistrationContext {
  event: RegistrableEvent;
  /** The way this person is trying to register. */
  mode: RegistrationMode;
  /** Confirmed registrations of the event: a pending one takes no seat. */
  registered: number;
  /** This same person (by email) is already registered and confirmed. */
  alreadyRegistered: boolean;
  now: Date;
}

/**
 * The single place that decides whether a registration is accepted; the repository calls it again, inside
 * the transaction that holds the event row, so a race cannot slip past a check made earlier.
 * Order matters: a person already in hears "duplicate" even when the event has since filled up.
 */
export function registrationRefusal({ event, mode, registered, alreadyRegistered, now }: RegistrationContext): RegistrationRefusal | null {
  if (!isPubliclyVisible(event, now)) {
    return "not_found";
  }

  if (event.registrationMode !== mode) {
    return "mode_mismatch";
  }

  if (isClosed(event, now)) {
    return "closed";
  }

  if (alreadyRegistered) {
    return "duplicate";
  }

  if (event.registrationCapacity !== null && registered >= event.registrationCapacity) {
    return "full";
  }

  return null;
}

/** What the open form collects: nothing else is stored. Career and semester are optional (people from outside the UNL). */
export interface OpenRegistrationData {
  name: string;
  email: string;
  institution: string;
  career: string | null;
  semester: number | null;
}

// Control characters (including NUL, line breaks and tabs) have no place in a name that ends up in a CSV and a sheet.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
// A lone surrogate (JSON's "\ud800") is not text: Postgres cannot store it, so it must be refused here, not become a 503.
const LONE_SURROGATE = /\p{Surrogate}/u;

function text(field: string, value: unknown, max: number): string {
  if (typeof value !== "string") {
    throw new ValidationError(field, `${field} is required`);
  }

  const collapsed = value.trim().replace(/\s+/g, " ");

  if (collapsed.length === 0 || collapsed.length > max || CONTROL_CHARACTERS.test(collapsed) || LONE_SURROGATE.test(collapsed)) {
    throw new ValidationError(field, `${field} must have 1 to ${max} characters, without control characters`);
  }

  return collapsed;
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim().length === 0);
}

function optionalText(field: string, value: unknown, max: number): string | null {
  return isBlank(value) ? null : text(field, value, max);
}

function semester(value: unknown): number | null {
  if (isBlank(value)) {
    return null;
  }

  const parsed = typeof value === "number" ? value : typeof value === "string" && /^\d{1,2}$/.test(value.trim()) ? Number(value.trim()) : Number.NaN;

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > REGISTRATION_SEMESTER_MAX) {
    throw new ValidationError("semester", `semester must be a whole number from 1 to ${REGISTRATION_SEMESTER_MAX}`);
  }

  return parsed;
}

/** Strict validation of the open form (untrusted input): throws `ValidationError` naming the first bad field. */
export function parseOpenRegistration(input: Record<string, unknown>): OpenRegistrationData {
  const name = text("name", input.name, REGISTRATION_NAME_MAX_LENGTH);
  const email = typeof input.email === "string" ? normalizeEmail(input.email) : normalizeEmail("");

  if (LONE_SURROGATE.test(email)) {
    throw new ValidationError("email", "email must be a valid address");
  }

  return {
    name,
    email,
    institution: text("institution", input.institution, REGISTRATION_INSTITUTION_MAX_LENGTH),
    career: optionalText("career", input.career, REGISTRATION_CAREER_MAX_LENGTH),
    semester: semester(input.semester),
  };
}
