import "server-only";

import { NotFoundError } from "@/application";

import { getCommandUseCases } from "./commands-container";
import { requirePageSession } from "../../auth/require-page-session";

/** Admin list: every free command, drafts included, in display order. */
export async function getAdminCommands() {
  await requirePageSession();
  return getCommandUseCases().list.execute();
}

/** One free command, or null when it does not exist. */
export async function getAdminCommand(id: string) {
  await requirePageSession();
  try {
    return await getCommandUseCases().get.execute({ id });
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
