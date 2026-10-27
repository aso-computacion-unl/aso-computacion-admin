import "server-only";

import { NotFoundError } from "@/application";

import { requirePageSession } from "../../auth/require-page-session";
import { getImpactStatUseCases } from "./impact-container";

/** Admin list: every stat, drafts included, in display order. */
export async function getAdminImpactStats() {
  await requirePageSession();
  return getImpactStatUseCases().list.execute();
}

/** One stat, or null when it does not exist. */
export async function getAdminImpactStat(id: string) {
  await requirePageSession();
  try {
    return await getImpactStatUseCases().get.execute({ id });
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
