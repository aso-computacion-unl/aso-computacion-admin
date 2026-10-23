import { ValidationError } from "./domain-error";
import { assertSortOrder } from "./sort-order";
import { httpsUrl, requiredText } from "./text";

export const PILLAR_WORD_MAX_LENGTH = 20;
export const PILLAR_TITLE_MAX_LENGTH = 60;
export const PILLAR_TEXT_MAX_LENGTH = 300;
export const PILLAR_IMAGE_ALT_MAX_LENGTH = 200;

/** A stored image plus the alt text the landing renders; the alt cannot exist without the image or vice versa. */
export interface PillarImage {
  readonly url: string;
  readonly publicId: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

export interface PillarProps {
  readonly id: string;
  readonly word: string;
  readonly title: string;
  readonly text: string;
  readonly image: PillarImage | null;
  readonly sortOrder: number;
  readonly isPublished: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface PillarFields {
  word: string;
  title: string;
  text: string;
  image: PillarImage | null;
  sortOrder: number;
  isPublished: boolean;
}

export type CreatePillarInput = Pick<PillarFields, "word" | "title" | "text" | "sortOrder"> &
  Partial<Pick<PillarFields, "image" | "isPublished">>;
/** `imageAlt` edits the alt of the current image; it never adds or removes an image. */
export type UpdatePillarInput = Partial<Pick<PillarFields, "word" | "title" | "text" | "isPublished">> & { imageAlt?: string };

/** Exposed so a caller can reject a bad alt before spending an upload on it. */
export function assertPillarImageAlt(alt: string): string {
  return requiredText("imageAlt", alt, PILLAR_IMAGE_ALT_MAX_LENGTH);
}

function positiveInteger(field: string, value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(field, `${field} must be a positive integer`);
  }

  return value;
}

function buildImage(image: PillarImage): PillarImage {
  return {
    url: httpsUrl("imageUrl", image.url),
    publicId: requiredText("imagePublicId", image.publicId, 255),
    width: positiveInteger("imageWidth", image.width),
    height: positiveInteger("imageHeight", image.height),
    alt: assertPillarImageAlt(image.alt),
  };
}

function build(base: Pick<PillarProps, "id" | "createdAt" | "updatedAt">, fields: PillarFields): PillarProps {
  return {
    ...base,
    word: requiredText("word", fields.word, PILLAR_WORD_MAX_LENGTH),
    title: requiredText("title", fields.title, PILLAR_TITLE_MAX_LENGTH),
    text: requiredText("text", fields.text, PILLAR_TEXT_MAX_LENGTH),
    image: fields.image ? buildImage(fields.image) : null,
    sortOrder: assertSortOrder(fields.sortOrder),
    isPublished: fields.isPublished,
  };
}

export class Pillar {
  private constructor(readonly props: PillarProps) {}

  static create(input: CreatePillarInput): Pillar {
    const now = new Date();

    return new Pillar(build({ id: crypto.randomUUID(), createdAt: now, updatedAt: now }, { ...input, image: input.image ?? null, isPublished: input.isPublished ?? false }));
  }

  /** Rehydrates a pillar from trusted persistence data without validation. */
  static reconstitute(props: PillarProps): Pillar {
    return new Pillar(props);
  }

  private with(changes: Partial<PillarFields>): Pillar {
    const { id, createdAt, ...fields } = this.props;
    const defined = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));

    return new Pillar(build({ id, createdAt, updatedAt: new Date() }, { ...fields, ...defined }));
  }

  update({ imageAlt, ...updates }: UpdatePillarInput): Pillar {
    const { image } = this.props;

    if (imageAlt === undefined || (!image && imageAlt.trim() === "")) {
      return this.with(updates);
    }

    if (!image) {
      throw new ValidationError("imageAlt", "imageAlt needs an image");
    }

    return this.with({ ...updates, image: { ...image, alt: imageAlt } });
  }

  withImage(image: PillarImage): Pillar {
    return this.with({ image });
  }

  withoutImage(): Pillar {
    return this.with({ image: null });
  }

  withPublished(isPublished: boolean): Pillar {
    return this.with({ isPublished });
  }

  withSortOrder(sortOrder: number): Pillar {
    return this.with({ sortOrder });
  }
}
