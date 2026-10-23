import { assertCalendarDate, todayInEcuador } from "./calendar-date";
import { ValidationError } from "./domain-error";
import { assertSlug, slugify } from "./slug";
import { httpsUrl, requiredText } from "./text";

export const NEWS_TITLE_MAX_LENGTH = 120;
export const NEWS_SUMMARY_MAX_LENGTH = 280;
export const NEWS_BODY_MAX_LENGTH = 10000;
export const NEWS_COVER_ALT_MAX_LENGTH = 200;

/** A stored image plus the alt text the landing renders; the alt cannot exist without the image or vice versa. */
export interface NewsCover {
  readonly url: string;
  readonly publicId: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

export interface NewsItemProps {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  /** Markdown subset (paragraphs, bold, italic, links, lists), stored as written: the landing renders it, never as raw HTML. */
  readonly body: string;
  /** Calendar date (YYYY-MM-DD) shown on the landing; newest first. */
  readonly publishedAt: string;
  readonly cover: NewsCover | null;
  readonly isPublished: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface NewsItemFields {
  title: string;
  /** Derived from the title when omitted on create. */
  slug: string;
  summary: string;
  body: string;
  /** Today in Ecuador when omitted on create. */
  publishedAt: string;
  cover: NewsCover | null;
  isPublished: boolean;
}

export type CreateNewsItemInput = Pick<NewsItemFields, "title" | "summary" | "body"> &
  Partial<Pick<NewsItemFields, "slug" | "publishedAt" | "cover" | "isPublished">>;
/** `coverAlt` edits the alt of the current cover; it never adds or removes a cover. */
export type UpdateNewsItemInput = Partial<Pick<NewsItemFields, "title" | "slug" | "summary" | "body" | "publishedAt" | "isPublished">> & {
  coverAlt?: string;
};

/** Exposed so a caller can reject a bad alt before spending an upload on it. */
export function assertNewsCoverAlt(alt: string): string {
  return requiredText("coverAlt", alt, NEWS_COVER_ALT_MAX_LENGTH);
}

function positiveInteger(field: string, value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(field, `${field} must be a positive integer`);
  }

  return value;
}

function buildCover(cover: NewsCover): NewsCover {
  return {
    url: httpsUrl("coverUrl", cover.url),
    publicId: requiredText("coverPublicId", cover.publicId, 255),
    width: positiveInteger("coverWidth", cover.width),
    height: positiveInteger("coverHeight", cover.height),
    alt: assertNewsCoverAlt(cover.alt),
  };
}

type BuildFields = Omit<NewsItemFields, "slug" | "publishedAt"> & Partial<Pick<NewsItemFields, "slug" | "publishedAt">>;

function build(base: Pick<NewsItemProps, "id" | "createdAt" | "updatedAt">, fields: BuildFields): NewsItemProps {
  const title = requiredText("title", fields.title, NEWS_TITLE_MAX_LENGTH);

  return {
    ...base,
    slug: assertSlug(fields.slug ?? slugify(title)),
    title,
    summary: requiredText("summary", fields.summary, NEWS_SUMMARY_MAX_LENGTH),
    body: requiredText("body", fields.body, NEWS_BODY_MAX_LENGTH),
    publishedAt: assertCalendarDate("publishedAt", fields.publishedAt ?? todayInEcuador(base.createdAt)),
    cover: fields.cover ? buildCover(fields.cover) : null,
    isPublished: fields.isPublished,
  };
}

export class NewsItem {
  private constructor(readonly props: NewsItemProps) {}

  static create(input: CreateNewsItemInput): NewsItem {
    const now = new Date();

    return new NewsItem(
      build({ id: crypto.randomUUID(), createdAt: now, updatedAt: now }, { ...input, cover: input.cover ?? null, isPublished: input.isPublished ?? false }),
    );
  }

  /** Rehydrates a news item from trusted persistence data without validation. */
  static reconstitute(props: NewsItemProps): NewsItem {
    return new NewsItem(props);
  }

  private with(changes: Partial<NewsItemFields>): NewsItem {
    const { id, createdAt, ...fields } = this.props;
    const defined = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));

    return new NewsItem(build({ id, createdAt, updatedAt: new Date() }, { ...fields, ...defined }));
  }

  /** Fields left out keep their value. The result is fully re-validated. */
  update({ coverAlt, ...updates }: UpdateNewsItemInput): NewsItem {
    const { cover } = this.props;

    if (coverAlt === undefined || (!cover && coverAlt.trim() === "")) {
      return this.with(updates);
    }

    if (!cover) {
      throw new ValidationError("coverAlt", "coverAlt needs a cover");
    }

    return this.with({ ...updates, cover: { ...cover, alt: coverAlt } });
  }

  withCover(cover: NewsCover): NewsItem {
    return this.with({ cover });
  }

  withoutCover(): NewsItem {
    return this.with({ cover: null });
  }

  withPublished(isPublished: boolean): NewsItem {
    return this.with({ isPublished });
  }
}
