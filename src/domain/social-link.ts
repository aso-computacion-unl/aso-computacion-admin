import { ValidationError } from "./domain-error";
import { assertSortOrder } from "./sort-order";
import { httpsUrl, optionalText, requiredText } from "./text";

export const SOCIAL_PLATFORMS = [
  "instagram",
  "tiktok",
  "linkedin",
  "twitch",
  "youtube",
  "github",
  "facebook",
  "x",
  "discord",
  "whatsapp",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_LABEL_MAX_LENGTH = 40;
export const SOCIAL_HANDLE_MAX_LENGTH = 60;
export const SOCIAL_NOTE_MAX_LENGTH = 40;
export const SOCIAL_BLURB_MAX_LENGTH = 80;

export interface SocialLinkProps {
  readonly id: string;
  readonly platform: SocialPlatform;
  readonly label: string;
  readonly handle: string;
  readonly url: string;
  readonly note: string | null;
  readonly blurb: string | null;
  readonly sortOrder: number;
  readonly isPublished: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SocialLinkFields {
  platform: string;
  label: string;
  handle: string;
  url: string;
  note: string | null | undefined;
  blurb: string | null | undefined;
  sortOrder: number;
  isPublished: boolean;
}

export type CreateSocialLinkInput = Pick<SocialLinkFields, "platform" | "label" | "handle" | "url" | "sortOrder"> &
  Partial<Pick<SocialLinkFields, "note" | "blurb" | "isPublished">>;
/** `undefined` keeps a field; a blank `note` or `blurb` clears it. */
export type UpdateSocialLinkInput = Partial<Pick<SocialLinkFields, "platform" | "label" | "handle" | "url" | "note" | "blurb" | "isPublished">>;

function assertPlatform(value: string): SocialPlatform {
  const platform = value.trim();

  if (!(SOCIAL_PLATFORMS as readonly string[]).includes(platform)) {
    throw new ValidationError("platform", `platform must be one of: ${SOCIAL_PLATFORMS.join(", ")}`);
  }

  return platform as SocialPlatform;
}

function build(base: Pick<SocialLinkProps, "id" | "createdAt" | "updatedAt">, fields: SocialLinkFields): SocialLinkProps {
  return {
    ...base,
    platform: assertPlatform(fields.platform),
    label: requiredText("label", fields.label, SOCIAL_LABEL_MAX_LENGTH),
    handle: requiredText("handle", fields.handle, SOCIAL_HANDLE_MAX_LENGTH),
    url: httpsUrl("url", fields.url),
    note: optionalText("note", fields.note, SOCIAL_NOTE_MAX_LENGTH),
    blurb: optionalText("blurb", fields.blurb, SOCIAL_BLURB_MAX_LENGTH),
    sortOrder: assertSortOrder(fields.sortOrder),
    isPublished: fields.isPublished,
  };
}

export class SocialLink {
  private constructor(readonly props: SocialLinkProps) {}

  static create(input: CreateSocialLinkInput): SocialLink {
    const now = new Date();

    return new SocialLink(
      build({ id: crypto.randomUUID(), createdAt: now, updatedAt: now }, { note: null, blurb: null, isPublished: false, ...input }),
    );
  }

  /** Rehydrates a social link from trusted persistence data without validation. */
  static reconstitute(props: SocialLinkProps): SocialLink {
    return new SocialLink(props);
  }

  private with(changes: Partial<SocialLinkFields>): SocialLink {
    const { id, createdAt, ...fields } = this.props;
    const defined = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));

    return new SocialLink(build({ id, createdAt, updatedAt: new Date() }, { ...fields, ...defined }));
  }

  update(updates: UpdateSocialLinkInput): SocialLink {
    return this.with(updates);
  }

  withPublished(isPublished: boolean): SocialLink {
    return this.with({ isPublished });
  }

  withSortOrder(sortOrder: number): SocialLink {
    return this.with({ sortOrder });
  }
}
