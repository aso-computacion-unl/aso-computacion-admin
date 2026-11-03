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

    // A failed attempt must not erase when the hook was last accepted: the scheduled-content cron relies on it.
    const accepted = outcome.ok ? { lastSuccessAt: now } : {};

    await prisma.deployStatus.upsert({
      where: { id: DEPLOY_STATUS_ID },
      create: { id: DEPLOY_STATUS_ID, ...data, ...accepted },
      update: { ...data, ...accepted },
    });
  }

  /** When the hook was last ACCEPTED, or null if never since this was recorded. */
  async findLastSuccessAt(): Promise<Date | null> {
    const record = await prisma.deployStatus.findUnique({ where: { id: DEPLOY_STATUS_ID }, select: { lastSuccessAt: true } });

    return record?.lastSuccessAt ?? null;
  }

  async findLast(): Promise<LastDeployStatus | null> {
    const record = await prisma.deployStatus.findUnique({ where: { id: DEPLOY_STATUS_ID } });

    return record && { attemptedAt: record.attemptedAt, ok: record.ok, httpStatus: record.httpStatus, errorKind: record.errorKind };
  }
}
