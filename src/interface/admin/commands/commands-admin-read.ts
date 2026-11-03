import "server-only";

import { NotFoundError, type ListCriteria } from "@/application";

import { PAGE_SIZE } from "../list-params";
import { getCommandUseCases } from "./commands-container";
import { requirePageSession } from "../../auth/require-page-session";

/** Admin list: every free command, drafts included, in display order. */
export async function getAdminCommands() {
  await requirePageSession();
  return getCommandUseCases().list.execute();
}

/** One page of the admin list in display order, narrowed by search; `page` is clamped to the last page that exists. */
export async function getAdminCommandsPage(criteria: ListCriteria, page: number) {
  await requirePageSession();
  return getCommandUseCases().listPage.execute(criteria, { page, pageSize: PAGE_SIZE });
}

/** Published and draft totals of the whole list. */
export async function getAdminCommandsCounts() {
  await requirePageSession();
  return getCommandUseCases().count.execute();
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
