import {
  CreateTerminalCommandUseCase,
  GetOrderedContentUseCase,
  ListOrderedContentUseCase,
  MoveOrderedContentUseCase,
  SetOrderedContentPublishedUseCase,
  UpdateTerminalCommandUseCase,
  TrashContentUseCase,
} from "@/application";
import { toTerminalCommandResult } from "@/application/mappers/terminal-command-result.mapper";
import { CommandNamePrismaRegistry, TerminalCommandPrismaRepository } from "@/infrastructure";

const NOT_FOUND = "Terminal command not found";

function createCommandUseCases() {
  const commands = new TerminalCommandPrismaRepository();
  const commandNames = new CommandNamePrismaRegistry();

  return {
    list: new ListOrderedContentUseCase(commands, toTerminalCommandResult),
    get: new GetOrderedContentUseCase(commands, toTerminalCommandResult, NOT_FOUND),
    create: new CreateTerminalCommandUseCase(commands, commandNames),
    update: new UpdateTerminalCommandUseCase(commands, commandNames),
    setPublished: new SetOrderedContentPublishedUseCase(commands, toTerminalCommandResult, NOT_FOUND),
    trash: new TrashContentUseCase(commands, NOT_FOUND),
    move: new MoveOrderedContentUseCase(commands, NOT_FOUND),
  };
}

let useCases: ReturnType<typeof createCommandUseCases> | undefined;

/** Built on first use, not at import time, so a build that only imports the actions needs no database. */
export function getCommandUseCases() {
  useCases ??= createCommandUseCases();
  return useCases;
}
