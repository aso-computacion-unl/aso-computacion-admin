import "server-only";

import { NotFoundError } from "@/application";

import { getFaqUseCases } from "./faqs-container";
import { requirePageSession } from "../../auth/require-page-session";

/** Admin list: every FAQ, drafts included, in display order. */
export async function getAdminFaqs() {
  await requirePageSession();
  return getFaqUseCases().list.execute();
}

/** One FAQ, or null when it does not exist. */
export async function getAdminFaq(id: string) {
  await requirePageSession();
  try {
    return await getFaqUseCases().get.execute({ id });
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
