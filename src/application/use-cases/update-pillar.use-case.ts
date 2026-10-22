import type { Pillar, UpdatePillarInput } from "@/domain/pillar";

import type { PillarResult } from "../dto/pillar-result.dto";
import { toPillarResult } from "../mappers/pillar-result.mapper";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { NotFoundError } from "./use-case-error";

export type UpdatePillarCommand = UpdatePillarInput & { id: string };

/** Text, publish flag and the alt of the current image. Adding, replacing or removing the image has its own use cases. */
export class UpdatePillarUseCase {
  constructor(private readonly pillars: OrderedContentRepository<Pillar>) {}

  async execute({ id, ...updates }: UpdatePillarCommand): Promise<PillarResult> {
    const pillar = await this.pillars.getById(id);

    if (!pillar) {
      throw new NotFoundError("Pillar not found");
    }

    return toPillarResult(await this.pillars.update(pillar.update(updates)));
  }
}
