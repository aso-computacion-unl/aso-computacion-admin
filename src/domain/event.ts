import { collectValidation, ValidationError } from "./domain-error";
import { assertEventKindKept, assertRegistrationDates, assertRegistrationSettings, type EventRegistrationMode, type SavedRegistration } from "./event-registration";
import { assertPublicationWindow } from "./publication-window";
import { titleAndSlug } from "./slug";
import { httpsUrl, optionalText, requiredText } from "./text";

/** Same vocabulary as the landing's activity filter chips. */
export const EVENT_TYPES = ["taller", "charla", "evento", "comunidad"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** `month` is a date known only to the month: stored as the first of that month. */
export const EVENT_DATE_PRECISIONS = ["day", "month"] as const;
export type EventDatePrecision = (typeof EVENT_DATE_PRECISIONS)[number];

export const EVENT_TITLE_MAX_LENGTH = 120;
export const EVENT_DESCRIPTION_MAX_LENGTH = 600;
export const EVENT_SHORT_TEXT_MAX_LENGTH = 80;
export const EVENT_HIGHLIGHTS_MAX = 8;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface EventProps {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  /** Calendar date (YYYY-MM-DD). A future date is an upcoming event, a past one is history. */
  readonly date: string | null;
  /** `month`: the day is unknown and `date` is the first of the month. Always `day` without a date. */
  readonly datePrecision: EventDatePrecision;
  readonly type: EventType | null;
  /** Playful conventional-commit line shown under the title, e.g. `feat: hackatón 24h`. */
  readonly commitMessage: string | null;
  readonly hora: string | null;
  readonly lugar: string | null;
  readonly para: string | null;
  readonly featured: boolean;
  readonly linkUrl: string | null;
  readonly linkLabel: string | null;
  /** Ordered short strings; the landing draws them as the entry's branch sub-items. */
  readonly highlights: readonly string[];
  readonly isPublished: boolean;
  /** Public from this instant (inclusive) while published; `null` is already open. */
  readonly publishAt: Date | null;
  /** Public until this instant (exclusive) while published; `null` never closes. */
  readonly unpublishAt: Date | null;
  /** How a person signs up (S8). `none`: no registration; capacity and deadline are then always null. */
  readonly registrationMode: EventRegistrationMode;
  /** Seats; `null` is unlimited. */
  readonly registrationCapacity: number | null;
  /** Registration closes at this instant (exclusive); `null`: it closes with the event day. */
  readonly registrationDeadline: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface EventFields {
  title: string;
  /** Derived from the title when omitted on create. */
  slug: string;
  description: string | null;
  date: string | null;
  datePrecision: string;
  type: string | null;
  commitMessage: string | null;
  hora: string | null;
  lugar: string | null;
  para: string | null;
  featured: boolean;
  linkUrl: string | null;
  linkLabel: string | null;
  highlights: readonly string[];
  isPublished: boolean;
  publishAt: Date | null;
  unpublishAt: Date | null;
  registrationMode: string;
  registrationCapacity: number | null;
  registrationDeadline: Date | null;
}

export type CreateEventInput = Pick<EventFields, "title"> & Partial<Omit<EventFields, "title">>;
export type UpdateEventInput = Partial<EventFields>;

function validateDate(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim() === "") {
    return null;
  }

  const trimmed = value.trim();
  const match = ISO_DATE_PATTERN.exec(trimmed);
  const [year, month, day] = match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [];
  const parsed = match ? new Date(Date.UTC(year!, month! - 1, day!)) : null;

  if (
    !parsed ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month! - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new ValidationError("date", "date must be a valid calendar date (YYYY-MM-DD)");
  }

  return trimmed;
}

function validateDatePrecision(value: string | undefined): EventDatePrecision {
  if (value === undefined) {
    return "day";
  }

  if (!(EVENT_DATE_PRECISIONS as readonly string[]).includes(value)) {
    throw new ValidationError("datePrecision", `datePrecision must be one of: ${EVENT_DATE_PRECISIONS.join(", ")}`);
  }

  return value as EventDatePrecision;
}

/** A month-only date is the first of its month; without a date there is nothing to be imprecise about. */
function normaliseDate(date: string | null, precision: EventDatePrecision) {
  if (date === null) {
    return { date, datePrecision: "day" as const };
  }

  return { date: precision === "month" ? `${date.slice(0, 7)}-01` : date, datePrecision: precision };
}

function validateType(value: string | null | undefined): EventType | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (!(EVENT_TYPES as readonly string[]).includes(value)) {
    throw new ValidationError("type", `type must be one of: ${EVENT_TYPES.join(", ")}`);
  }

  return value as EventType;
}

function validateHighlights(values: readonly string[] | undefined): string[] {
  const highlights = values ?? [];

  if (highlights.length > EVENT_HIGHLIGHTS_MAX) {
    throw new ValidationError("highlights", `highlights must have at most ${EVENT_HIGHLIGHTS_MAX} entries`);
  }

  return highlights.map((value) => requiredText("highlights", value, EVENT_SHORT_TEXT_MAX_LENGTH));
}

function validateLink(url: string | null | undefined, label: string | null | undefined) {
  const linkUrl = url === null || url === undefined || url.trim() === "" ? null : httpsUrl("linkUrl", url);
  const linkLabel = optionalText("linkLabel", label, EVENT_SHORT_TEXT_MAX_LENGTH);

  if (linkLabel !== null && linkUrl === null) {
    throw new ValidationError("linkLabel", "linkLabel needs a linkUrl");
  }

  return { linkUrl, linkLabel };
}

const NOTHING_SAVED: SavedRegistration = { mode: "none", capacity: null, deadline: null, date: null, datePrecision: "day" };

/** The event's date as saved, or `null` when it is invalid: the date check reports that, not the registration one. */
function checkedDate(fields: Partial<EventFields>) {
  try {
    return normaliseDate(validateDate(fields.date), validateDatePrecision(fields.datePrecision));
  } catch (error) {
    if (error instanceof ValidationError) return null;
    throw error;
  }
}

function registrationFields(fields: Partial<EventFields>, previous: SavedRegistration, now: Date) {
  const settings = assertRegistrationSettings(fields.registrationMode, fields.registrationCapacity, fields.registrationDeadline);
  const date = checkedDate(fields);

  if (date) {
    assertRegistrationDates(settings, date, previous, now);
  }

  return { registrationMode: settings.mode, registrationCapacity: settings.capacity, registrationDeadline: settings.deadline };
}

/** Every independent rule is checked, so one save reports all of them; the slug derived from a bad title is not. */
function build(
  base: Pick<EventProps, "id" | "createdAt" | "updatedAt">,
  fields: Partial<EventFields> & Pick<EventFields, "title">,
  previous: SavedRegistration = NOTHING_SAVED,
): EventProps {
  return collectValidation(
    {
      identity: () => titleAndSlug(fields.title, fields.slug, EVENT_TITLE_MAX_LENGTH),
      description: () => optionalText("description", fields.description, EVENT_DESCRIPTION_MAX_LENGTH),
      date: () => validateDate(fields.date),
      datePrecision: () => validateDatePrecision(fields.datePrecision),
      type: () => validateType(fields.type),
      commitMessage: () => optionalText("commitMessage", fields.commitMessage, EVENT_SHORT_TEXT_MAX_LENGTH),
      hora: () => optionalText("hora", fields.hora, EVENT_SHORT_TEXT_MAX_LENGTH),
      lugar: () => optionalText("lugar", fields.lugar, EVENT_SHORT_TEXT_MAX_LENGTH),
      para: () => optionalText("para", fields.para, EVENT_SHORT_TEXT_MAX_LENGTH),
      link: () => validateLink(fields.linkUrl, fields.linkLabel),
      highlights: () => validateHighlights(fields.highlights),
      publication: () => assertPublicationWindow(fields.publishAt ?? null, fields.unpublishAt ?? null),
      // `updatedAt` is the instant of this save.
      registration: () => registrationFields(fields, previous, base.updatedAt),
    },
    (checked) => ({
      ...base,
      slug: checked.identity.slug,
      title: checked.identity.title,
      description: checked.description,
      ...normaliseDate(checked.date, checked.datePrecision),
      type: checked.type,
      commitMessage: checked.commitMessage,
      hora: checked.hora,
      lugar: checked.lugar,
      para: checked.para,
      featured: fields.featured ?? false,
      ...checked.link,
      highlights: checked.highlights,
      isPublished: fields.isPublished ?? false,
      ...checked.publication,
      ...checked.registration,
    }),
  );
}

export class Event {
  private constructor(readonly props: EventProps) {}

  static create(input: CreateEventInput): Event {
    const now = new Date();

    return new Event(build({ id: crypto.randomUUID(), createdAt: now, updatedAt: now }, input));
  }

  /** Rehydrates an event from trusted persistence data without validation. */
  static reconstitute(props: EventProps): Event {
    return new Event(props);
  }

  /** Fields left out keep their value; `null` clears an optional one. The result is fully re-validated. */
  update(updates: UpdateEventInput): Event {
    const current = this.props;
    const definedUpdates = Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined));
    assertEventKindKept(current.registrationMode, updates.registrationMode ?? undefined);

    return new Event(
      build(
        { id: current.id, createdAt: current.createdAt, updatedAt: new Date() },
        { ...current, ...definedUpdates },
        {
          mode: current.registrationMode,
          capacity: current.registrationCapacity,
          deadline: current.registrationDeadline,
          date: current.date,
          datePrecision: current.datePrecision,
        },
      ),
    );
  }
}
