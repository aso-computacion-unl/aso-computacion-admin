import { ValidationError } from "./domain-error";

/**
 * When a published item is public: from `publishAt` (inclusive) until `unpublishAt` (exclusive). A `null`
 * end is open, so an item with no window behaves exactly as it did before windows existed.
 */
export interface PublicationWindow {
  readonly publishAt: Date | null;
  readonly unpublishAt: Date | null;
}

export type PublicationState = "draft" | "scheduled" | "live" | "expired";

export interface Windowed extends PublicationWindow {
  readonly isPublished: boolean;
}

/** `isPublished` stays the master switch: a draft is a draft whatever its window says. */
export function publicationState(item: Windowed, now: Date): PublicationState {
  if (!item.isPublished) {
    return "draft";
  }

  if (item.publishAt && now.getTime() < item.publishAt.getTime()) {
    return "scheduled";
  }

  if (item.unpublishAt && now.getTime() >= item.unpublishAt.getTime()) {
    return "expired";
  }

  return "live";
}

export function isPubliclyVisible(item: Windowed, now: Date): boolean {
  return publicationState(item, now) === "live";
}

/**
 * True when a published item's window opened or closed in (`since`, `now`]: the landing built before
 * `since` shows it wrongly now. `since` is when the landing last accepted a rebuild (`null`: never known,
 * so every boundary up to now counts). Both ends of the interval follow `publicationState`: a boundary
 * exactly at `now` already changed the state, one exactly at `since` was already in that build.
 */
export function crossedWindowBetween(item: Windowed, since: Date | null, now: Date): boolean {
  if (!item.isPublished) {
    return false;
  }

  return [item.publishAt, item.unpublishAt].some(
    (boundary) => boundary !== null && boundary.getTime() <= now.getTime() && (since === null || boundary.getTime() > since.getTime()),
  );
}

function assertInstant(field: string, value: Date | null): Date | null {
  if (value !== null && Number.isNaN(value.getTime())) {
    throw new ValidationError(field, `${field} must be a valid date and time`);
  }

  return value;
}

/** Both ends must be real instants and the window must close after it opens (the DB CHECK says the same). */
export function assertPublicationWindow(publishAt: Date | null, unpublishAt: Date | null): PublicationWindow {
  const start = assertInstant("publishAt", publishAt);
  const end = assertInstant("unpublishAt", unpublishAt);

  if (start && end && end.getTime() <= start.getTime()) {
    throw new ValidationError("unpublishAt", "unpublishAt must be after publishAt");
  }

  return { publishAt: start, unpublishAt: end };
}
