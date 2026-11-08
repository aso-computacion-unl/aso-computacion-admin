import type { ReactNode } from "react";

import { formatEventDate } from "@/interface/admin/events/event-timeline";
import { parseMarkdownSubset, type InlineNode } from "@/interface/admin/markdown-subset";
import { thumbnailUrl } from "@/lib/cloudinary-thumbnail";

import { Changed, SiteSection } from "../../_components/publish-preview";
import type { PublishField } from "../../_components/publish-diff";
import type { NewsFormValues } from "./news-form";

/** What the owner can change on a news item, in the words of the list of changes. */
export const NEWS_PUBLISH_FIELDS: readonly PublishField<NewsFormValues>[] = [
  { name: "title", label: "Título" },
  { name: "summary", label: "Resumen" },
  { name: "body", label: "Texto" },
  { name: "coverAlt", label: "Descripción de la portada" },
  { name: "publishedAt", label: "Fecha de publicación", format: (values) => (values.publishedAt ? formatEventDate(values.publishedAt) : "Hoy") },
  { name: "publishAt", label: "Publicar el" },
  { name: "unpublishAt", label: "Retirar el" },
  { name: "slug", label: "Identificador" },
];

interface NewsPreviewProps {
  values: NewsFormValues;
  /** The stored cover, when the item has one; its alt is the one in the form. */
  cover: { url: string; width: number; height: number } | null;
  /** The names of the fields to highlight. */
  changed: ReadonlySet<string>;
}

function renderInline(nodes: InlineNode[]): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
      // The news grammar never produces inline code (that is the forum's); kept as plain text if it ever did.
      case "code":
        return node.text;
      case "strong":
        return <strong key={index}>{renderInline(node.children)}</strong>;
      case "em":
        return <em key={index}>{renderInline(node.children)}</em>;
      case "link":
        return (
          <a key={index} href={node.href} target="_blank" rel="noopener noreferrer" className="text-sky underline underline-offset-4">
            {renderInline(node.children)}
          </a>
        );
    }
  });
}

/** Approximate: the same Markdown subset as the site, in the admin's own type. The site applies its own design. */
export function NewsPreview({ values, cover, changed }: NewsPreviewProps) {
  const blocks = parseMarkdownSubset(values.body);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(values.publishedAt) ? formatEventDate(values.publishedAt) : "";

  return (
    <>
      <SiteSection number="01">Novedades</SiteSection>
      <article className="grid gap-3 rounded border border-paper-ring p-5">
        {cover ? (
          // Remote Cloudinary asset, requested at thumbnail size; a plain <img> is enough in the admin.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl(cover.url, 400, 267)} alt={values.coverAlt} loading="lazy" decoding="async" width={cover.width} height={cover.height} className="aspect-3/2 w-full max-w-md rounded-xs object-cover" />
        ) : null}
        {date ? (
          <p className="font-mono text-xs font-semibold text-sky tabular-nums">
            <Changed on={changed.has("publishedAt")}>{date}</Changed>
          </p>
        ) : null}
        {values.title.trim() ? (
          <h3 className="font-display text-2xl leading-tight wrap-anywhere text-foreground">
            <Changed on={changed.has("title")}>{values.title}</Changed>
          </h3>
        ) : null}
        {values.summary.trim() ? (
          <p className="text-mist wrap-anywhere">
            <Changed on={changed.has("summary")}>{values.summary}</Changed>
          </p>
        ) : null}
        <Changed on={changed.has("body")}>
          <div className="grid gap-3 text-[0.9375rem] wrap-anywhere">
            {blocks.map((block, index) =>
              block.type === "paragraph" ? (
                <p key={index}>{renderInline(block.children)}</p>
              ) : (
                <ul key={index} className="grid list-disc gap-1 pl-5 marker:text-sky">
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{renderInline(item)}</li>
                  ))}
                </ul>
              ),
            )}
          </div>
        </Changed>
      </article>
    </>
  );
}
