import type { EventDatePrecision, EventType } from "@/domain/event";
import type { EventRegistrationMode } from "@/domain/event-registration";

/** Plain shape returned by event use cases; mirrors `EventProps` without exposing the entity. */
export interface EventResult {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  /** YYYY-MM-DD */
  date: string | null;
  /** `month`: `date` is the first of the month and the day is unknown. */
  datePrecision: EventDatePrecision;
  type: EventType | null;
  commitMessage: string | null;
  hora: string | null;
  lugar: string | null;
  para: string | null;
  featured: boolean;
  linkUrl: string | null;
  linkLabel: string | null;
  highlights: string[];
  isPublished: boolean;
  /** Public from this instant (inclusive) while published; `null` is already open. */
  publishAt: Date | null;
  /** Public until this instant (exclusive) while published; `null` never closes. */
  unpublishAt: Date | null;
  /** How a person signs up; `none` when the event takes no registration. */
  registrationMode: EventRegistrationMode;
  /** Seats; `null` is unlimited. */
  registrationCapacity: number | null;
  /** Registration closes at this instant (exclusive); `null`: it closes with the event day. */
  registrationDeadline: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventPhotoResult {
  id: string;
  eventId: string;
  url: string;
  publicId: string;
  width: number;
  height: number;
  alt: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}

export interface EventListItemResult extends EventResult {
  photoCount: number;
}

export interface EventDetailResult extends EventResult {
  /** Active photos only, in gallery order. */
  photos: EventPhotoResult[];
}
