import { reportError } from "../observability/report-error";

/** Why a hook call failed without an HTTP answer. A coarse label on purpose: an error message can carry the hook URL. */
export type DeployErrorKind = "timeout" | "network";

/** What one deploy-hook attempt came to. `ok` means Cloudflare accepted the request, not that the build finished. */
export type DeployOutcome = { ok: true; httpStatus: number } | { ok: false; httpStatus?: number; errorKind?: DeployErrorKind };

export interface LastDeployStatus {
  attemptedAt: Date;
  ok: boolean;
  httpStatus: number | null;
  errorKind: string | null;
}

// Loaded on first use: the deploy hook is imported by code (and tests) that never touch the database.
async function repository() {
  const { DeployStatusPrismaRepository } = await import("../repositories/deploy-status-prisma.repository");

  return new DeployStatusPrismaRepository();
}

/**
 * Persists the outcome of a deploy-hook attempt for the admin to show. Never throws: a status that cannot be
 * written must not fail the content action that triggered the rebuild, so a failure is logged and reported.
 */
export async function recordDeployOutcome(outcome: DeployOutcome, now: Date = new Date()): Promise<void> {
  try {
    await (await repository()).record(outcome, now);
  } catch (error) {
    // No error text in the log line: a database error can carry the connection string.
    console.warn("Could not record the landing deploy status.");
    reportError(error, { area: "deploy-status" });
  }
}

/** The last recorded attempt, or `null` when none was ever made. Throws when the database is unreachable. */
export async function readLastDeployStatus(): Promise<LastDeployStatus | null> {
  return (await repository()).findLast();
}
