import "server-only";

import { NotFoundError } from "@/application";

import { requirePageSession } from "../../auth/require-page-session";
import { getSponsorUseCases } from "./sponsors-container";

/** Admin list: every sponsor, drafts included, in display order. */
export async function getAdminSponsors() {
  await requirePageSession();
  return getSponsorUseCases().list.execute();
}

/** One sponsor, or null when it does not exist. */
export async function getAdminSponsor(id: string) {
  await requirePageSession();
  try {
    return await getSponsorUseCases().get.execute({ id });
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
