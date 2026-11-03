import type { ImpactStat, UpdateImpactStatInput } from "@/domain/impact-stat";

import type { ImpactStatResult } from "../dto/impact-stat-result.dto";
import { toImpactStatResult } from "../mappers/impact-stat-result.mapper";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { NotFoundError } from "./use-case-error";

export type UpdateImpactStatCommand = UpdateImpactStatInput & { id: string };

export class UpdateImpactStatUseCase {
  constructor(private readonly stats: OrderedContentRepository<ImpactStat>) {}

  async execute({ id, ...updates }: UpdateImpactStatCommand): Promise<ImpactStatResult> {
    const stat = await this.stats.getById(id);

    if (!stat) {
      throw new NotFoundError("Impact stat not found");
    }

    return toImpactStatResult(await this.stats.update(stat.update(updates)));
  }
}
