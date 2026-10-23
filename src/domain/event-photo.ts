import { ValidationError } from "./domain-error";
import { httpsUrl, requiredText } from "./text";

export const MAX_ACTIVE_EVENT_PHOTOS = 12;
export const EVENT_PHOTO_ALT_MAX_LENGTH = 200;

export interface EventPhotoProps {
  readonly id: string;
  readonly eventId: string;
  readonly url: string;
  readonly publicId: string;
  readonly width: number;
  readonly height: number;
  /** Accessibility text; required because the landing renders it as the image alt. */
  readonly alt: string;
  readonly sortOrder: number;
  /** Photos are deactivated, never deleted: the asset stays in storage. */
  readonly isActive: boolean;
  readonly createdAt: Date;
}

export interface CreateEventPhotoInput {
  eventId: string;
  url: string;
  publicId: string;
  width: number;
  height: number;
  alt: string;
  sortOrder: number;
}

/** Exposed so a caller can reject a bad alt before spending an upload on it. */
export function assertEventPhotoAlt(alt: string): string {
  return requiredText("alt", alt, EVENT_PHOTO_ALT_MAX_LENGTH);
}

function positiveInteger(field: string, value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(field, `${field} must be a positive integer`);
  }

  return value;
}

function validSortOrder(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError("sortOrder", "sortOrder must be a non-negative integer");
  }

  return value;
}

export class EventPhoto {
  private constructor(readonly props: EventPhotoProps) {}

  static create(input: CreateEventPhotoInput): EventPhoto {
    return new EventPhoto({
      id: crypto.randomUUID(),
      eventId: input.eventId,
      url: httpsUrl("url", input.url),
      publicId: requiredText("publicId", input.publicId, 255),
      width: positiveInteger("width", input.width),
      height: positiveInteger("height", input.height),
      alt: assertEventPhotoAlt(input.alt),
      sortOrder: validSortOrder(input.sortOrder),
      isActive: true,
      createdAt: new Date(),
    });
  }

  /** Rehydrates a photo from trusted persistence data without validation. */
  static reconstitute(props: EventPhotoProps): EventPhoto {
    return new EventPhoto(props);
  }

  withAlt(alt: string): EventPhoto {
    return new EventPhoto({ ...this.props, alt: assertEventPhotoAlt(alt) });
  }

  withSortOrder(sortOrder: number): EventPhoto {
    return new EventPhoto({ ...this.props, sortOrder: validSortOrder(sortOrder) });
  }

  deactivate(): EventPhoto {
    return new EventPhoto({ ...this.props, isActive: false });
  }
}
