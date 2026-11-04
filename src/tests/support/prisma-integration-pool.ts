import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/infrastructure/prisma/create-client";

import { assertPrismaIntegrationEnvironment } from "./prisma-integration-cleanup";

/**
 * Tests that park several transactions on a row lock need a pool of a known
 * size or they starve it and time out. Prisma 6 sized its pool at physical
 * cores * 2 + 1 (13 connections on a laptop, 5 on a 4 vCPU CI runner); the
 * `pg` pool behind the driver adapter defaults to 10, pinned here anyway.
 */
export const INTEGRATION_POOL_SIZE = 10;

/**
 * Installs the shared `prisma` client with an explicit pool. The environment
 * keeps the canonical URLs, so the target guards still compare exact values;
 * only this client gets the explicit pool size, and only after those guards
 * accept the target. `src/infrastructure/prisma/client.ts` reuses the
 * global instance, so it has to run before anything imports that module.
 */
export function installIntegrationPrismaClient(
  testDatabaseUrl: string | undefined,
  prismaDatabaseUrl: string | undefined,
): void {
  const target = assertPrismaIntegrationEnvironment(testDatabaseUrl, prismaDatabaseUrl);
  const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
  globalForPrisma.prisma = createPrismaClient(target.toString(), { max: INTEGRATION_POOL_SIZE });
}
