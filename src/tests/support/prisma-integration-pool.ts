import { PrismaClient } from "@prisma/client";

import { assertPrismaIntegrationEnvironment } from "./prisma-integration-cleanup";

/**
 * Prisma sizes its pool at physical cores * 2 + 1 unless told otherwise, so
 * the same suite saw 13 connections on a laptop and 5 on a 4 vCPU CI runner.
 * Tests that park several transactions on a row lock need a known pool or
 * they starve it and time out.
 */
export const INTEGRATION_POOL_SIZE = 10;

/**
 * Installs the shared `prisma` client with an explicit pool. The environment
 * keeps the canonical URLs, so the target guards still compare exact values;
 * only this client gets the extra `connection_limit`, and only after those
 * guards accept the target. `src/infrastructure/prisma/client.ts` reuses the
 * global instance, so it has to run before anything imports that module.
 */
export function installIntegrationPrismaClient(
  testDatabaseUrl: string | undefined,
  prismaDatabaseUrl: string | undefined,
): void {
  const target = assertPrismaIntegrationEnvironment(testDatabaseUrl, prismaDatabaseUrl);
  target.searchParams.set("connection_limit", String(INTEGRATION_POOL_SIZE));

  const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
  globalForPrisma.prisma = new PrismaClient({ datasources: { db: { url: target.toString() } } });
}
