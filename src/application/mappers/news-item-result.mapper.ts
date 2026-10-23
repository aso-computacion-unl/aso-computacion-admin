import type { NewsItem } from "@/domain/news-item";

import type { NewsItemResult } from "../dto/news-item-result.dto";

export function toNewsItemResult({ props }: NewsItem): NewsItemResult {
  const { cover } = props;

  return {
    id: props.id,
    slug: props.slug,
    title: props.title,
    summary: props.summary,
    body: props.body,
    publishedAt: props.publishedAt,
    cover: cover && { url: cover.url, width: cover.width, height: cover.height, alt: cover.alt },
    isPublished: props.isPublished,
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
  };
}
