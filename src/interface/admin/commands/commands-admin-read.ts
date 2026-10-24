import "server-only";

import { NotFoundError } from "@/application";

import { getCommandUseCases } from "./commands-container";

/** Admin list: every free command, drafts included, in display order. */
export function getAdminCommands() {
  return getCommandUseCases().list.execute();
}

/** One free command, or null when it does not exist. */
export async function getAdminCommand(id: string) {
  try {
    return await getCommandUseCases().get.execute({ id });
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
