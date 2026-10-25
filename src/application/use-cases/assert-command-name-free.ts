import { CommandNameConflictError } from "@/domain/command-name";

import type { CommandNameOwner, CommandNameRegistry } from "../ports/command-name-registry.port";

/** Throws `CommandNameConflictError` when another FAQ or free command already uses the name. */
export async function assertCommandNameFree(
  registry: CommandNameRegistry,
  command: string,
  except?: { kind: CommandNameOwner; id: string },
): Promise<void> {
  const owner = await registry.findOwner(command, except);

  if (owner) {
    throw new CommandNameConflictError("command", command, owner);
  }
}
