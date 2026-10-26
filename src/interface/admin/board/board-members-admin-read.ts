import "server-only";

import { NotFoundError } from "@/application";

import { getBoardMemberUseCases } from "./board-members-container";
import { requirePageSession } from "../../auth/require-page-session";

/** Admin list: every member, drafts included, in display order. */
export async function getAdminBoardMembers() {
  await requirePageSession();
  return getBoardMemberUseCases().list.execute();
}

/** One member, or null when it does not exist. */
export async function getAdminBoardMember(id: string) {
  await requirePageSession();
  try {
    return await getBoardMemberUseCases().get.execute({ id });
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
