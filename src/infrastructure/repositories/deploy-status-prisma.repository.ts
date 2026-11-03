import "server-only";

import type { DeployOutcome, LastDeployStatus } from "../deploy/deploy-status";
import { prisma } from "../prisma/client";

const DEPLOY_STATUS_ID = "landing";

/** The single-row log of the last deploy-hook attempt. */
export class DeployStatusPrismaRepository {
  async record(outcome: DeployOutcome, now: Date): Promise<void> {
    const data = {
      attemptedAt: now,
      ok: outcome.ok,
      httpStatus: outcome.httpStatus ?? null,
      errorKind: outcome.ok ? null : (outcome.errorKind ?? null),
    };

    await prisma.deployStatus.upsert({ where: { id: DEPLOY_STATUS_ID }, create: { id: DEPLOY_STATUS_ID, ...data }, update: data });
  }

  async findLast(): Promise<LastDeployStatus | null> {
    const record = await prisma.deployStatus.findUnique({ where: { id: DEPLOY_STATUS_ID } });

    return record && { attemptedAt: record.attemptedAt, ok: record.ok, httpStatus: record.httpStatus, errorKind: record.errorKind };
  }
}
