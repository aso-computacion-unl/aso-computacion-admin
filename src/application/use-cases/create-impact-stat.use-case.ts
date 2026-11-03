import { ImpactStat, type CreateImpactStatInput } from "@/domain/impact-stat";

import type { ImpactStatResult } from "../dto/impact-stat-result.dto";
import { toImpactStatResult } from "../mappers/impact-stat-result.mapper";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { nextSortOrder } from "./ordered-content.use-cases";

export type CreateImpactStatCommand = Omit<CreateImpactStatInput, "sortOrder">;

/** New stats go to the end of the list; ordering is changed with move up/down. */
export class CreateImpactStatUseCase {
  constructor(private readonly stats: OrderedContentRepository<ImpactStat>) {}

  async execute({ value, label, isPublished }: CreateImpactStatCommand): Promise<ImpactStatResult> {
    const sortOrder = nextSortOrder(await this.stats.list());

    return toImpactStatResult(await this.stats.create(ImpactStat.create({ value, label, isPublished, sortOrder })));
  }
}
