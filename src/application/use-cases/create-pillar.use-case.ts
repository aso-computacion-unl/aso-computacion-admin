import { Pillar, type CreatePillarInput } from "@/domain/pillar";

import type { PillarResult } from "../dto/pillar-result.dto";
import { toPillarResult } from "../mappers/pillar-result.mapper";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { nextSortOrder } from "./ordered-content.use-cases";

export type CreatePillarCommand = Pick<CreatePillarInput, "word" | "title" | "text" | "isPublished">;

/**
 * New pillars go to the end of the list, without an image: the image is added
 * afterwards with `SetPillarImageUseCase`, once the pillar has an id.
 */
export class CreatePillarUseCase {
  constructor(private readonly pillars: OrderedContentRepository<Pillar>) {}

  async execute({ word, title, text, isPublished }: CreatePillarCommand): Promise<PillarResult> {
    const sortOrder = nextSortOrder(await this.pillars.list());

    return toPillarResult(await this.pillars.create(Pillar.create({ word, title, text, isPublished, sortOrder })));
  }
}
