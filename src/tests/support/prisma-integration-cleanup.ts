import { assertSafePrismaTestTarget } from "./prisma-test-target";

type TableCleanup = () => Promise<unknown>;

export function assertPrismaIntegrationEnvironment(
  testDatabaseUrl: string | undefined,
  prismaDatabaseUrl: string | undefined,
): URL {
  const testTarget = assertSafePrismaTestTarget(testDatabaseUrl);

  if (prismaDatabaseUrl !== testDatabaseUrl) {
    throw new Error("DATABASE_URL must exactly match TEST_DATABASE_URL before Prisma cleanup.");
  }

  assertSafePrismaTestTarget(prismaDatabaseUrl);

  return testTarget;
}

export async function createPrismaIntegrationCleanup(
  testDatabaseUrl: string | undefined,
  prismaDatabaseUrl: string | undefined,
  cleanup: TableCleanup,
): Promise<void> {
  assertPrismaIntegrationEnvironment(testDatabaseUrl, prismaDatabaseUrl);
  await cleanup();
}
