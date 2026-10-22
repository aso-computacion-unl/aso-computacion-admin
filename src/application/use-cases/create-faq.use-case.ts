import { Faq } from "@/domain/faq";

import type { FaqResult } from "../dto/faq-result.dto";
import { toFaqResult } from "../mappers/faq-result.mapper";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { nextSortOrder } from "./ordered-content.use-cases";

export interface CreateFaqCommand {
  question: string;
  answer: string;
  isPublished?: boolean;
}

/** New FAQs go to the end of the list; ordering is changed with move up/down. */
export class CreateFaqUseCase {
  constructor(private readonly faqs: OrderedContentRepository<Faq>) {}

  async execute(command: CreateFaqCommand): Promise<FaqResult> {
    const sortOrder = nextSortOrder(await this.faqs.list());

    return toFaqResult(await this.faqs.create(Faq.create({ ...command, sortOrder })));
  }
}
