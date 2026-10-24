import type { CommandNameOwner, CommandNameRegistry } from "@/application/ports/command-name-registry.port";
import type { OrderedContentRepository } from "@/application/ports/ordered-content-repository.port";
import type { Faq } from "@/domain/faq";
import type { TerminalCommand } from "@/domain/terminal-command";

/** Reads the in-memory repositories the way the Prisma registry reads the tables. */
export class InMemoryCommandNameRegistry implements CommandNameRegistry {
  constructor(
    private readonly faqs: OrderedContentRepository<Faq>,
    private readonly commands: OrderedContentRepository<TerminalCommand> | null = null,
  ) {}

  async findOwner(command: string, except?: { kind: CommandNameOwner; id: string }): Promise<CommandNameOwner | null> {
    const taken = (kind: CommandNameOwner, items: readonly { props: { id: string; command: string | null } }[]) =>
      items.some(({ props }) => props.command === command && !(except?.kind === kind && except.id === props.id));

    if (taken("faq", await this.faqs.list())) return "faq";

    return this.commands && taken("command", await this.commands.list()) ? "command" : null;
  }
}
