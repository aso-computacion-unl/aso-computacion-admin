export function createIntegrationEnvironment(
  testDatabaseUrl: string | undefined,
  environment: Record<string, string | undefined>,
  temporaryDirectory: string,
): Record<string, string | undefined>;

interface SpawnResult {
  error?: { code?: string } | null;
  status?: number | null;
}

interface IntegrationTestDependencies {
  spawn?: (...arguments_: unknown[]) => SpawnResult;
  createTemporaryDirectory?: () => string;
  removeTemporaryDirectory?: (directory: string) => void;
}

export function runPrismaIntegrationTests(
  environment?: Record<string, string | undefined>,
  dependencies?: IntegrationTestDependencies,
): void;
