import type { CommandNameOwner, CommandNameRegistry } from "@/application/ports/command-name-registry.port";
import type { OrderedContentRepository } from "@/application/ports/ordered-content-repository.port";
import type { Faq } from "@/domain/faq";

/** Reads the in-memory repositories the way the Prisma registry reads the tables. */
export class InMemoryCommandNameRegistry implements CommandNameRegistry {
  constructor(private readonly faqs: OrderedContentRepository<Faq>) {}

  async findOwner(command: string, except?: { kind: CommandNameOwner; id: string }): Promise<CommandNameOwner | null> {
    const faq = (await this.faqs.list()).find(({ props }) => props.command === command && !(except?.kind === "faq" && except.id === props.id));

    return faq ? "faq" : null;
  }
}
