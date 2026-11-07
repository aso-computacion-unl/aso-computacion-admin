import { thumbnailUrl } from "@/lib/cloudinary-thumbnail";

import { Changed, SiteSection } from "../../_components/publish-preview";
import type { PublishField } from "../../_components/publish-diff";
import type { SponsorFormValues } from "./sponsor-form";

/** What the owner can change on a sponsor, in the words of the list of changes. */
export const SPONSOR_PUBLISH_FIELDS: readonly PublishField<SponsorFormValues>[] = [
  { name: "name", label: "Nombre" },
  { name: "url", label: "Enlace" },
  { name: "logoAlt", label: "Descripción del logo" },
];

interface SponsorPreviewProps {
  values: SponsorFormValues;
  /** The stored logo, when the sponsor has one; its alt is the one in the form. */
  logo: { url: string } | null;
  /** The names of the fields to highlight. */
  changed: ReadonlySet<string>;
}

/** Approximate: the sponsor's logo, linked when it has an address, in the admin's own type. The site applies its own design. */
export function SponsorPreview({ values, logo, changed }: SponsorPreviewProps) {
  const url = values.url.trim();
  const image = logo ? (
    // Remote Cloudinary asset, requested at thumbnail size; a plain <img> is enough in the admin.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={thumbnailUrl(logo.url, 240)} alt={values.logoAlt} loading="lazy" decoding="async" className="max-h-24 w-auto max-w-full object-contain" />
  ) : null;

  return (
    <>
      <SiteSection number="01">Aliados</SiteSection>
      <figure className="grid w-fit max-w-60 gap-3 rounded border border-paper-ring p-4">
        {image && url ? (
          <a href={url} target="_blank" rel="noreferrer noopener" className="w-fit">
            {image}
          </a>
        ) : (
          image
        )}
        {values.name.trim() ? (
          <figcaption className="font-mono text-xs font-semibold wrap-anywhere text-foreground">
            <Changed on={changed.has("name")}>{values.name}</Changed>
          </figcaption>
        ) : null}
        {url ? (
          <p className="font-mono text-xs wrap-anywhere text-mist">
            <Changed on={changed.has("url")}>{url}</Changed>
          </p>
        ) : null}
      </figure>
    </>
  );
}
