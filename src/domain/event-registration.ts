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
export const REGISTRATION_SEMESTER_MAX = 12;

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

export interface RegistrationContext {
  event: RegistrableEvent;
  /** The way this person is trying to register. */
  mode: RegistrationMode;
  /** Registrations already stored for the event. */
  registered: number;
  /** This same person (by email) is already registered. */
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

/** What the open form collects: nothing else is stored. */
export interface OpenRegistrationData {
  name: string;
  email: string;
  career: string;
  semester: number;
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

function semester(value: unknown): number {
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

  return { name, email, career: text("career", input.career, REGISTRATION_CAREER_MAX_LENGTH), semester: semester(input.semester) };
}
