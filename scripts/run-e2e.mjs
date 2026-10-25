import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { createIntegrationEnvironment } from "./run-prisma-integration-tests.mjs";
import { assertSafePrismaTestTarget, CANONICAL_TEST_DATABASE_URL } from "./prisma-test-target.mjs";

// The same disposable Postgres as the integration tests (docker-compose.test.yml, canonical test URL only),
// under its own compose project so the two never share a volume.
const COMPOSE_PROJECT_NAME = "aso-computacion-admin-e2e";
const COMPOSE_ARGUMENTS = ["--context", "default", "compose", "--project-name", COMPOSE_PROJECT_NAME, "-f", "docker-compose.test.yml"];

// Test-only values, used when the caller (CI defines its own) does not set them. They guard nothing real.
const E2E_ADMIN_PASSWORD = "e2e-only-admin-password-0123456789";
const E2E_ADMIN_SECRET = "e2e-only-session-secret-0123456789-abcdefghij";

function run(command, arguments_, environment, label) {
  const result = spawnSync(command, arguments_, { env: environment, stdio: "inherit" });

  if (result.error || result.status !== 0) {
    throw new Error(`${label} failed${result.status === null ? "" : ` (exit status ${result.status})`}.`);
  }
}

export function runE2e(environment = process.env) {
  const testDatabaseUrl = environment.TEST_DATABASE_URL ?? CANONICAL_TEST_DATABASE_URL;
  assertSafePrismaTestTarget(testDatabaseUrl);

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "aso-computacion-admin-e2e-"));
  // Docker and Prisma get the stripped environment of the integration runner. The app, the build and
  // the browser keep the real one (HOME holds the installed Chromium) plus the test-only values.
  const databaseEnvironment = createIntegrationEnvironment(testDatabaseUrl, environment, temporaryDirectory);
  const appEnvironment = {
    ...environment,
    DATABASE_URL: testDatabaseUrl,
    TEST_DATABASE_URL: testDatabaseUrl,
    ADMIN_PASSWORD: environment.ADMIN_PASSWORD ?? E2E_ADMIN_PASSWORD,
    ADMIN_SECRET: environment.ADMIN_SECRET ?? E2E_ADMIN_SECRET,
  };
  let composeAttempted = false;
  let failure;

  try {
    composeAttempted = true;
    run("docker", [...COMPOSE_ARGUMENTS, "up", "-d", "--wait"], databaseEnvironment, "Docker Compose startup");
    run("npx", ["prisma", "migrate", "deploy"], databaseEnvironment, "Prisma migration");
    run("npx", ["next", "build"], appEnvironment, "Next build");
    run("npx", ["playwright", "test"], appEnvironment, "Playwright");
  } catch (error) {
    failure = error;
  }

  try {
    if (composeAttempted) {
      run("docker", [...COMPOSE_ARGUMENTS, "down", "-v", "--remove-orphans"], databaseEnvironment, "Docker Compose cleanup");
    }
  } catch (cleanupError) {
    failure ??= cleanupError;
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }

  if (failure) {
    throw failure;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    runE2e();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
