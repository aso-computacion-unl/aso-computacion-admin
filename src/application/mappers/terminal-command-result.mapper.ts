import type { TerminalCommand } from "@/domain/terminal-command";

import type { TerminalCommandResult } from "../dto/terminal-command-result.dto";

export function toTerminalCommandResult(command: TerminalCommand): TerminalCommandResult {
  return { ...command.props };
}
