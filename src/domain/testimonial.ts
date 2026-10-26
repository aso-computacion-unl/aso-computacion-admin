import { ValidationError } from "./domain-error";
import { assertSortOrder } from "./sort-order";
import { assertImageAlt, buildStoredImage, type StoredImage } from "./stored-image";
import { requiredText } from "./text";

export const TESTIMONIAL_QUOTE_MAX_LENGTH = 300;
export const TESTIMONIAL_NAME_MAX_LENGTH = 60;
export const TESTIMONIAL_ROLE_MAX_LENGTH = 80;

export type TestimonialPhoto = StoredImage;

/**
 * A quote and who said it: name, role or affiliation, and an optional photo.
 * Like the board (S4) there is deliberately no contact field (email, phone,
 * handle) and none may be added; a testimonial is public.
 */
export interface TestimonialProps {
  readonly id: string;
  readonly quote: string;
  readonly name: string;
  /** Role or affiliation: "Egresada de Computación", "Docente UNL". */
  readonly role: string;
  readonly photo: TestimonialPhoto | null;
  readonly sortOrder: number;
  readonly isPublished: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface TestimonialFields {
  quote: string;
  name: string;
  role: string;
  photo: TestimonialPhoto | null;
  sortOrder: number;
  isPublished: boolean;
}

export type CreateTestimonialInput = Pick<TestimonialFields, "quote" | "name" | "role" | "sortOrder"> &
  Partial<Pick<TestimonialFields, "photo" | "isPublished">>;
/** `photoAlt` edits the alt of the current photo; it never adds or removes a photo. */
export type UpdateTestimonialInput = Partial<Pick<TestimonialFields, "quote" | "name" | "role" | "isPublished">> & { photoAlt?: string };

/** Exposed so a caller can reject a bad alt before spending an upload on it. */
export function assertTestimonialPhotoAlt(alt: string): string {
  return assertImageAlt("photo", alt);
}

function build(base: Pick<TestimonialProps, "id" | "createdAt" | "updatedAt">, fields: TestimonialFields): TestimonialProps {
  return {
    ...base,
    quote: requiredText("quote", fields.quote, TESTIMONIAL_QUOTE_MAX_LENGTH),
    name: requiredText("name", fields.name, TESTIMONIAL_NAME_MAX_LENGTH),
    role: requiredText("role", fields.role, TESTIMONIAL_ROLE_MAX_LENGTH),
    photo: fields.photo ? buildStoredImage("photo", fields.photo) : null,
    sortOrder: assertSortOrder(fields.sortOrder),
    isPublished: fields.isPublished,
  };
}

export class Testimonial {
  private constructor(readonly props: TestimonialProps) {}

  static create(input: CreateTestimonialInput): Testimonial {
    const now = new Date();

    return new Testimonial(build({ id: crypto.randomUUID(), createdAt: now, updatedAt: now }, { photo: null, isPublished: false, ...input }));
  }

  /** Rehydrates a testimonial from trusted persistence data without validation. */
  static reconstitute(props: TestimonialProps): Testimonial {
    return new Testimonial(props);
  }

  private with(changes: Partial<TestimonialFields>): Testimonial {
    const { id, createdAt, ...fields } = this.props;
    const defined = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));

    return new Testimonial(build({ id, createdAt, updatedAt: new Date() }, { ...fields, ...defined }));
  }

  update({ photoAlt, ...updates }: UpdateTestimonialInput): Testimonial {
    const { photo } = this.props;

    if (photoAlt === undefined || (!photo && photoAlt.trim() === "")) {
      return this.with(updates);
    }

    if (!photo) {
      throw new ValidationError("photoAlt", "photoAlt needs a photo");
    }

    return this.with({ ...updates, photo: { ...photo, alt: photoAlt } });
  }

  withPhoto(photo: TestimonialPhoto): Testimonial {
    return this.with({ photo });
  }

  /** The photo is optional, so removing it leaves the publish flag alone. */
  withoutPhoto(): Testimonial {
    return this.with({ photo: null });
  }

  withPublished(isPublished: boolean): Testimonial {
    return this.with({ isPublished });
  }

  withSortOrder(sortOrder: number): Testimonial {
    return this.with({ sortOrder });
  }
}
