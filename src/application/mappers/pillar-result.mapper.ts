import type { Pillar } from "@/domain/pillar";

import type { PillarResult } from "../dto/pillar-result.dto";

export function toPillarResult({ props }: Pillar): PillarResult {
  const { image } = props;

  return {
    id: props.id,
    word: props.word,
    title: props.title,
    text: props.text,
    image: image && { url: image.url, width: image.width, height: image.height, alt: image.alt },
    sortOrder: props.sortOrder,
    isPublished: props.isPublished,
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
  };
}
