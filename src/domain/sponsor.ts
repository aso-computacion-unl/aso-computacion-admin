import { ValidationError } from "./domain-error";
import { assertSortOrder } from "./sort-order";
import { assertImageAlt, buildStoredImage, type StoredImage } from "./stored-image";
import { httpsUrl, optionalText, requiredText } from "./text";

export const SPONSOR_NAME_MAX_LENGTH = 60;
export const SPONSOR_URL_MAX_LENGTH = 300;

export type SponsorLogo = StoredImage;

/** A sponsor or ally: name, logo (with alt text) and an optional https link. */
export interface SponsorProps {
  readonly id: string;
  readonly name: string;
  readonly logo: SponsorLogo | null;
  /** Where the landing links the logo; `null` renders it without a link. */
  readonly url: string | null;
  readonly sortOrder: number;
  readonly isPublished: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface SponsorFields {
  name: string;
  logo: SponsorLogo | null;
  url: string | null | undefined;
  sortOrder: number;
  isPublished: boolean;
}

export type CreateSponsorInput = Pick<SponsorFields, "name" | "sortOrder"> & Partial<Pick<SponsorFields, "logo" | "url" | "isPublished">>;
/** `logoAlt` edits the alt of the current logo; it never adds or removes a logo. A blank `url` clears the link. */
export type UpdateSponsorInput = Partial<Pick<SponsorFields, "name" | "url" | "isPublished">> & { logoAlt?: string };

/** Exposed so a caller can reject a bad alt before spending an upload on it. */
export function assertSponsorLogoAlt(alt: string): string {
  return assertImageAlt("logo", alt);
}

function optionalHttpsUrl(value: string | null | undefined): string | null {
  const text = optionalText("url", value, SPONSOR_URL_MAX_LENGTH);

  return text === null ? null : httpsUrl("url", text);
}

function build(base: Pick<SponsorProps, "id" | "createdAt" | "updatedAt">, fields: SponsorFields): SponsorProps {
  const logo = fields.logo ? buildStoredImage("logo", fields.logo) : null;

  // A published sponsor without a logo would render an empty slot on the landing.
  if (fields.isPublished && !logo) {
    throw new ValidationError("logo", "a sponsor needs a logo to be published");
  }

  return {
    ...base,
    name: requiredText("name", fields.name, SPONSOR_NAME_MAX_LENGTH),
    logo,
    url: optionalHttpsUrl(fields.url),
    sortOrder: assertSortOrder(fields.sortOrder),
    isPublished: fields.isPublished,
  };
}

export class Sponsor {
  private constructor(readonly props: SponsorProps) {}

  static create(input: CreateSponsorInput): Sponsor {
    const now = new Date();

    return new Sponsor(build({ id: crypto.randomUUID(), createdAt: now, updatedAt: now }, { ...input, logo: input.logo ?? null, url: input.url ?? null, isPublished: input.isPublished ?? false }));
  }

  /** Rehydrates a sponsor from trusted persistence data without validation. */
  static reconstitute(props: SponsorProps): Sponsor {
    return new Sponsor(props);
  }

  private with(changes: Partial<SponsorFields>): Sponsor {
    const { id, createdAt, ...fields } = this.props;
    const defined = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));

    return new Sponsor(build({ id, createdAt, updatedAt: new Date() }, { ...fields, ...defined }));
  }

  update({ logoAlt, ...updates }: UpdateSponsorInput): Sponsor {
    const { logo } = this.props;

    if (logoAlt === undefined || (!logo && logoAlt.trim() === "")) {
      return this.with(updates);
    }

    if (!logo) {
      throw new ValidationError("logoAlt", "logoAlt needs a logo");
    }

    return this.with({ ...updates, logo: { ...logo, alt: logoAlt } });
  }

  withLogo(logo: SponsorLogo): Sponsor {
    return this.with({ logo });
  }

  /** Without a logo the sponsor cannot be published, so removing it also unpublishes. */
  withoutLogo(): Sponsor {
    return this.with({ logo: null, isPublished: false });
  }

  withPublished(isPublished: boolean): Sponsor {
    return this.with({ isPublished });
  }

  withSortOrder(sortOrder: number): Sponsor {
    return this.with({ sortOrder });
  }
}
