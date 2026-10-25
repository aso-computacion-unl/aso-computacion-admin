import type { Faq, UpdateFaqInput } from "@/domain/faq";

import type { FaqResult } from "../dto/faq-result.dto";
import { toFaqResult } from "../mappers/faq-result.mapper";
import type { CommandNameRegistry } from "../ports/command-name-registry.port";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { assertCommandNameFree } from "./assert-command-name-free";
import { NotFoundError } from "./use-case-error";

export type UpdateFaqCommand = UpdateFaqInput & { id: string };

export class UpdateFaqUseCase {
  constructor(
    private readonly faqs: OrderedContentRepository<Faq>,
    private readonly commandNames: CommandNameRegistry,
  ) {}

  async execute({ id, ...updates }: UpdateFaqCommand): Promise<FaqResult> {
    const faq = await this.faqs.getById(id);

    if (!faq) {
      throw new NotFoundError("Faq not found");
    }

    const updated = faq.update(updates);

    // Only a changed command is checked: saving a FAQ never fails because of the name it already holds.
    if (updated.props.command && updated.props.command !== faq.props.command) {
      await assertCommandNameFree(this.commandNames, updated.props.command, { kind: "faq", id });
    }

    return toFaqResult(await this.faqs.update(updated));
  }
}
