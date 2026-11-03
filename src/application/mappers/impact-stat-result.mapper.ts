import type { ImpactStat } from "@/domain/impact-stat";

import type { ImpactStatResult } from "../dto/impact-stat-result.dto";

export function toImpactStatResult({ props }: ImpactStat): ImpactStatResult {
  return {
    id: props.id,
    value: props.value,
    label: props.label,
    sortOrder: props.sortOrder,
    isPublished: props.isPublished,
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
  };
}
