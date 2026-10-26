import "server-only";

import { readLastDeployStatus, type LastDeployStatus } from "@/infrastructure/deploy/deploy-status";
import { requirePageSession } from "../auth/require-page-session";

/** The last deploy-hook attempt, `null` when none was made, `undefined` when the read itself failed (the dashboard then shows nothing). */
export async function getLastDeployStatus(): Promise<LastDeployStatus | null | undefined> {
  await requirePageSession();
  try {
    return await readLastDeployStatus();
  } catch {
    return undefined;
  }
}
