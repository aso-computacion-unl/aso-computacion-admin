import { ValidationError } from "./domain-error";
import { assertSortOrder } from "./sort-order";
import { httpsUrl, requiredText } from "./text";

export const BOARD_MEMBER_NAME_MAX_LENGTH = 60;
export const BOARD_MEMBER_ROLE_MAX_LENGTH = 60;
export const BOARD_MEMBER_PHOTO_ALT_MAX_LENGTH = 200;

/** A stored photo plus the alt text the landing renders; the alt cannot exist without the photo or vice versa. */
export interface BoardMemberPhoto {
  readonly url: string;
  readonly publicId: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

/**
 * S4: the board shows only name, role and photo. There is deliberately no
 * contact field (phone, email, age, personal handle, study cycle) and none may
 * be added here; `board-member-privacy.test.ts` pins the exact set of keys.
 */
export interface BoardMemberProps {
  readonly id: string;
  /** The public display name shown on the landing. */
  readonly name: string;
  readonly role: string;
  readonly photo: BoardMemberPhoto | null;
  readonly sortOrder: number;
  readonly isPublished: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface BoardMemberFields {
  name: string;
  role: string;
  photo: BoardMemberPhoto | null;
  sortOrder: number;
  isPublished: boolean;
}

export type CreateBoardMemberInput = Pick<BoardMemberFields, "name" | "role" | "sortOrder"> &
  Partial<Pick<BoardMemberFields, "photo" | "isPublished">>;
/** `photoAlt` edits the alt of the current photo; it never adds or removes a photo. */
export type UpdateBoardMemberInput = Partial<Pick<BoardMemberFields, "name" | "role" | "isPublished">> & { photoAlt?: string };

/** Exposed so a caller can reject a bad alt before spending an upload on it. */
export function assertBoardMemberPhotoAlt(alt: string): string {
  return requiredText("photoAlt", alt, BOARD_MEMBER_PHOTO_ALT_MAX_LENGTH);
}

function positiveInteger(field: string, value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(field, `${field} must be a positive integer`);
  }

  return value;
}

function buildPhoto(photo: BoardMemberPhoto): BoardMemberPhoto {
  return {
    url: httpsUrl("photoUrl", photo.url),
    publicId: requiredText("photoPublicId", photo.publicId, 255),
    width: positiveInteger("photoWidth", photo.width),
    height: positiveInteger("photoHeight", photo.height),
    alt: assertBoardMemberPhotoAlt(photo.alt),
  };
}

function build(base: Pick<BoardMemberProps, "id" | "createdAt" | "updatedAt">, fields: BoardMemberFields): BoardMemberProps {
  const photo = fields.photo ? buildPhoto(fields.photo) : null;

  // A published member without a photo would render an empty card on the landing.
  if (fields.isPublished && !photo) {
    throw new ValidationError("photo", "a board member needs a photo to be published");
  }

  return {
    ...base,
    name: requiredText("name", fields.name, BOARD_MEMBER_NAME_MAX_LENGTH),
    role: requiredText("role", fields.role, BOARD_MEMBER_ROLE_MAX_LENGTH),
    photo,
    sortOrder: assertSortOrder(fields.sortOrder),
    isPublished: fields.isPublished,
  };
}

export class BoardMember {
  private constructor(readonly props: BoardMemberProps) {}

  static create(input: CreateBoardMemberInput): BoardMember {
    const now = new Date();

    return new BoardMember(
      build({ id: crypto.randomUUID(), createdAt: now, updatedAt: now }, { ...input, photo: input.photo ?? null, isPublished: input.isPublished ?? false }),
    );
  }

  /** Rehydrates a member from trusted persistence data without validation. */
  static reconstitute(props: BoardMemberProps): BoardMember {
    return new BoardMember(props);
  }

  private with(changes: Partial<BoardMemberFields>): BoardMember {
    const { id, createdAt, ...fields } = this.props;
    const defined = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));

    return new BoardMember(build({ id, createdAt, updatedAt: new Date() }, { ...fields, ...defined }));
  }

  update({ photoAlt, ...updates }: UpdateBoardMemberInput): BoardMember {
    const { photo } = this.props;

    if (photoAlt === undefined || (!photo && photoAlt.trim() === "")) {
      return this.with(updates);
    }

    if (!photo) {
      throw new ValidationError("photoAlt", "photoAlt needs a photo");
    }

    return this.with({ ...updates, photo: { ...photo, alt: photoAlt } });
  }

  withPhoto(photo: BoardMemberPhoto): BoardMember {
    return this.with({ photo });
  }

  /** Without a photo the member cannot be published, so removing it also unpublishes. */
  withoutPhoto(): BoardMember {
    return this.with({ photo: null, isPublished: false });
  }

  withPublished(isPublished: boolean): BoardMember {
    return this.with({ isPublished });
  }

  withSortOrder(sortOrder: number): BoardMember {
    return this.with({ sortOrder });
  }
}
