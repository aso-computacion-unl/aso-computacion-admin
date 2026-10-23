import "server-only";

import { NotFoundError } from "@/application";

import { getPillarUseCases } from "./pillars-container";

/** Admin list: every pillar, drafts included, in display order. */
export function getAdminPillars() {
  return getPillarUseCases().list.execute();
}

/** One pillar, or null when it does not exist. */
export async function getAdminPillar(id: string) {
  try {
    return await getPillarUseCases().get.execute({ id });
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
