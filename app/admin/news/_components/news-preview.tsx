import type { ReactNode } from "react";

import { formatEventDate } from "@/interface/admin/events/event-timeline";
import { parseMarkdownSubset, type InlineNode } from "@/interface/admin/markdown-subset";

import { Panel } from "../../_components/page-head";

export interface NewsPreviewValues {
  title: string;
  summary: string;
  body: string;
  publishedAt: string;
}

interface NewsPreviewProps {
  values: NewsPreviewValues;
  /** The stored cover, when the item has one; its alt is the one in the form. */
  cover: { url: string; width: number; height: number } | null;
  coverAlt: string;
}

function renderInline(nodes: InlineNode[]): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
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
export function NewsPreview({ values, cover, coverAlt }: NewsPreviewProps) {
  const blocks = parseMarkdownSubset(values.body);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(values.publishedAt) ? formatEventDate(values.publishedAt) : "";
  const empty = values.title.trim() === "" && values.summary.trim() === "" && blocks.length === 0;

  return (
    <Panel aria-labelledby="news-preview-heading" className="grid gap-4 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="news-preview-heading" className="text-lg font-bold font-stretch-[112%]">
          Vista previa
        </h2>
        <p className="font-mono text-[0.8125rem] text-mist">se actualiza al escribir</p>
      </div>
      {empty ? (
        <p role="status" className="text-mist">
          Escriba el título, el resumen o el texto para ver cómo se lee.
        </p>
      ) : (
        <article className="grid gap-3 rounded bg-muted p-4">
          {cover ? (
            // Remote Cloudinary asset shown as-is in the admin; no image optimisation needed.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.url} alt={coverAlt} width={cover.width} height={cover.height} className="aspect-3/2 w-full rounded-xs object-cover" />
          ) : null}
          {date ? <p className="font-mono text-xs font-semibold text-sky tabular-nums">{date}</p> : null}
          {values.title.trim() ? <h3 className="font-display text-xl leading-tight wrap-anywhere">{values.title}</h3> : null}
          {values.summary.trim() ? <p className="text-mist wrap-anywhere">{values.summary}</p> : null}
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
        </article>
      )}
    </Panel>
  );
}
