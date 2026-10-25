import type { TerminalCommand, UpdateTerminalCommandInput } from "@/domain/terminal-command";

import type { TerminalCommandResult } from "../dto/terminal-command-result.dto";
import { toTerminalCommandResult } from "../mappers/terminal-command-result.mapper";
import type { CommandNameRegistry } from "../ports/command-name-registry.port";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import { assertCommandNameFree } from "./assert-command-name-free";
import { NotFoundError } from "./use-case-error";

export type UpdateTerminalCommandCommand = UpdateTerminalCommandInput & { id: string };

export class UpdateTerminalCommandUseCase {
  constructor(
    private readonly commands: OrderedContentRepository<TerminalCommand>,
    private readonly commandNames: CommandNameRegistry,
  ) {}

  async execute({ id, ...updates }: UpdateTerminalCommandCommand): Promise<TerminalCommandResult> {
    const command = await this.commands.getById(id);

    if (!command) {
      throw new NotFoundError("Terminal command not found");
    }

    const updated = command.update(updates);

    // Only a changed name is checked: saving a command never fails because of the name it already holds.
    if (updated.props.command !== command.props.command) {
      await assertCommandNameFree(this.commandNames, updated.props.command, { kind: "command", id });
    }

    return toTerminalCommandResult(await this.commands.update(updated));
  }
}
