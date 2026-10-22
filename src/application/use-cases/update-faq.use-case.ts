import type { Faq, UpdateFaqInput } from "@/domain/faq";

import type { FaqResult } from "../dto/faq-result.dto";
import { toFaqResult } from "../mappers/faq-result.mapper";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { NotFoundError } from "./use-case-error";

export type UpdateFaqCommand = UpdateFaqInput & { id: string };

export class UpdateFaqUseCase {
  constructor(private readonly faqs: OrderedContentRepository<Faq>) {}

  async execute({ id, ...updates }: UpdateFaqCommand): Promise<FaqResult> {
    const faq = await this.faqs.getById(id);

    if (!faq) {
      throw new NotFoundError("Faq not found");
    }

    return toFaqResult(await this.faqs.update(faq.update(updates)));
  }
}
