import "server-only";

import { NotFoundError } from "@/application";

import { getSocialLinkUseCases } from "./socials-container";

/** Admin list: every social link, drafts included, in display order. */
export function getAdminSocialLinks() {
  return getSocialLinkUseCases().list.execute();
}

/** One social link, or null when it does not exist. */
export async function getAdminSocialLink(id: string) {
  try {
    return await getSocialLinkUseCases().get.execute({ id });
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
