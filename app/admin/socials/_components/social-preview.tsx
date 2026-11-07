import { socialPlatformLabel } from "@/interface/admin/socials/platform-labels";

import { Changed, SiteSection } from "../../_components/publish-preview";
import type { PublishField } from "../../_components/publish-diff";
import type { SocialFormValues } from "./social-form";

/** What the owner can change on a social link, in the words of the list of changes. */
export const SOCIAL_PUBLISH_FIELDS: readonly PublishField<SocialFormValues>[] = [
  { name: "platform", label: "Red", format: (values) => socialPlatformLabel(values.platform) },
  { name: "label", label: "Nombre" },
  { name: "handle", label: "Usuario" },
  { name: "url", label: "Enlace" },
  { name: "note", label: "Nota" },
  { name: "blurb", label: "Descripción corta" },
];

interface SocialPreviewProps {
  values: SocialFormValues;
  /** The names of the fields to highlight. */
  changed: ReadonlySet<string>;
}

/** Approximate: the link as the site lists it, in the admin's own type. The site applies its own design. */
export function SocialPreview({ values, changed }: SocialPreviewProps) {
  const url = values.url.trim();
  const name = (
    <>
      <Changed on={changed.has("label")}>{values.label}</Changed>
      {values.note.trim() ? (
        <span className="ml-2 font-mono text-xs font-semibold text-sky">
          <Changed on={changed.has("note")}>{values.note}</Changed>
        </span>
      ) : null}
    </>
  );

  return (
    <>
      <SiteSection number="01">Redes</SiteSection>
      <div className="grid max-w-md gap-2 rounded border border-paper-ring p-5">
        <p className="font-display text-xl leading-tight wrap-anywhere text-foreground">
          {url ? (
            <a href={url} target="_blank" rel="noreferrer noopener" className="underline-offset-4 hover:underline">
              {name}
            </a>
          ) : (
            name
          )}
        </p>
        {values.handle.trim() ? (
          <p className="font-mono text-sm wrap-anywhere text-mist">
            <Changed on={changed.has("handle")}>{values.handle}</Changed>
          </p>
        ) : null}
        {values.blurb.trim() ? (
          <p className="text-mist wrap-anywhere">
            <Changed on={changed.has("blurb")}>{values.blurb}</Changed>
          </p>
        ) : null}
      </div>
    </>
  );
}
