import { TerminalCommand } from "@/domain/terminal-command";

import type { TerminalCommandResult } from "../dto/terminal-command-result.dto";
import { toTerminalCommandResult } from "../mappers/terminal-command-result.mapper";
import type { CommandNameRegistry } from "../ports/command-name-registry.port";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { assertCommandNameFree } from "./assert-command-name-free";
import { nextSortOrder } from "./ordered-content.use-cases";

export interface CreateTerminalCommandCommand {
  command: string;
  description: string;
  output: string;
  isPublished?: boolean;
}

/** New commands go to the end of the list; ordering is changed with move up/down. */
export class CreateTerminalCommandUseCase {
  constructor(
    private readonly commands: OrderedContentRepository<TerminalCommand>,
    private readonly commandNames: CommandNameRegistry,
  ) {}

  async execute(input: CreateTerminalCommandCommand): Promise<TerminalCommandResult> {
    const command = TerminalCommand.create({ ...input, sortOrder: nextSortOrder(await this.commands.list()) });

    await assertCommandNameFree(this.commandNames, command.props.command);

    return toTerminalCommandResult(await this.commands.create(command));
  }
}
