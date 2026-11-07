import { thumbnailUrl } from "@/lib/cloudinary-thumbnail";

import { Changed, SiteSection } from "../../_components/publish-preview";
import type { PublishField } from "../../_components/publish-diff";
import type { PillarFormValues } from "./pillar-form";

/** What the owner can change on a pillar, in the words of the list of changes. */
export const PILLAR_PUBLISH_FIELDS: readonly PublishField<PillarFormValues>[] = [
  { name: "word", label: "Palabra" },
  { name: "title", label: "Título" },
  { name: "text", label: "Texto" },
  { name: "imageAlt", label: "Descripción de la imagen" },
];

interface PillarPreviewProps {
  values: PillarFormValues;
  /** The stored image, when the pillar has one; its alt is the one in the form. */
  image: { url: string } | null;
  /** The names of the fields to highlight. */
  changed: ReadonlySet<string>;
}

/** Approximate: the pillar's card in the admin's own type. The site applies its own design. */
export function PillarPreview({ values, image, changed }: PillarPreviewProps) {
  return (
    <>
      <SiteSection number="01">Pilares</SiteSection>
      <article className="grid max-w-md gap-3 rounded border border-paper-ring p-5">
        {image ? (
          // Remote Cloudinary asset, requested at thumbnail size; a plain <img> is enough in the admin.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl(image.url, 400, 267)} alt={values.imageAlt} loading="lazy" decoding="async" width={400} height={267} className="aspect-3/2 w-full rounded-xs object-cover" />
        ) : null}
        {values.word.trim() ? (
          <p className="font-display text-4xl leading-none tracking-tight wrap-anywhere text-sky">
            <Changed on={changed.has("word")}>{values.word}</Changed>
          </p>
        ) : null}
        {values.title.trim() ? (
          <h3 className="font-display text-xl leading-tight wrap-anywhere text-foreground">
            <Changed on={changed.has("title")}>{values.title}</Changed>
          </h3>
        ) : null}
        {values.text.trim() ? (
          <p className="text-mist wrap-anywhere whitespace-pre-line">
            <Changed on={changed.has("text")}>{values.text}</Changed>
          </p>
        ) : null}
      </article>
    </>
  );
}
