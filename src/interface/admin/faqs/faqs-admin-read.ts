import "server-only";

import { NotFoundError } from "@/application";

import { getFaqUseCases } from "./faqs-container";

/** Admin list: every FAQ, drafts included, in display order. */
export function getAdminFaqs() {
  return getFaqUseCases().list.execute();
}

/** One FAQ, or null when it does not exist. */
export async function getAdminFaq(id: string) {
  try {
    return await getFaqUseCases().get.execute({ id });
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
