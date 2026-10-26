import "server-only";

import { NotFoundError } from "@/application";

import { getSocialLinkUseCases } from "./socials-container";
import { requirePageSession } from "../../auth/require-page-session";

/** Admin list: every social link, drafts included, in display order. */
export async function getAdminSocialLinks() {
  await requirePageSession();
  return getSocialLinkUseCases().list.execute();
}

/** One social link, or null when it does not exist. */
export async function getAdminSocialLink(id: string) {
  await requirePageSession();
  try {
    return await getSocialLinkUseCases().get.execute({ id });
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
