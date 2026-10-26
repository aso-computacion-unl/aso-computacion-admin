import "server-only";

import { NotFoundError, type ListCriteria } from "@/application";

import { PAGE_SIZE } from "../list-params";
import { getFaqUseCases } from "./faqs-container";
import { requirePageSession } from "../../auth/require-page-session";

/** Admin list: every FAQ, drafts included, in display order. */
export async function getAdminFaqs() {
  await requirePageSession();
  return getFaqUseCases().list.execute();
}

/** One page of the admin list in display order, narrowed by search; `page` is clamped to the last page that exists. */
export async function getAdminFaqsPage(criteria: ListCriteria, page: number) {
  await requirePageSession();
  return getFaqUseCases().listPage.execute(criteria, { page, pageSize: PAGE_SIZE });
}

/** Published and draft totals of the whole list. */
export async function getAdminFaqsCounts() {
  await requirePageSession();
  return getFaqUseCases().count.execute();
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
