import { Faq } from "@/domain/faq";

import type { FaqResult } from "../dto/faq-result.dto";
import { toFaqResult } from "../mappers/faq-result.mapper";
import type { CommandNameRegistry } from "../ports/command-name-registry.port";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { assertCommandNameFree } from "./assert-command-name-free";
import { nextSortOrder } from "./ordered-content.use-cases";

export interface CreateFaqCommand {
  question: string;
  answer: string;
  /** Blank or null: no command, the landing keeps the auto-generated topic. */
  command?: string | null;
  isPublished?: boolean;
}

/** New FAQs go to the end of the list; ordering is changed with move up/down. */
export class CreateFaqUseCase {
  constructor(
    private readonly faqs: OrderedContentRepository<Faq>,
    private readonly commandNames: CommandNameRegistry,
  ) {}

  async execute(command: CreateFaqCommand): Promise<FaqResult> {
    const faq = Faq.create({ ...command, sortOrder: nextSortOrder(await this.faqs.list()) });

    if (faq.props.command) {
      await assertCommandNameFree(this.commandNames, faq.props.command);
    }

    return toFaqResult(await this.faqs.create(faq));
  }
}
