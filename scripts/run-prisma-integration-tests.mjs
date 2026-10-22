import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { assertSafePrismaTestTarget } from "./prisma-test-target.mjs";

const INHERITED_ENVIRONMENT_KEYS = [
  "PATH",
  "TEMP",
  "TMP",
  "TMPDIR",
  "USERPROFILE",
];

const COMPOSE_PROJECT_NAME = "aso-computacion-admin-prisma-test";
const LOCAL_DOCKER_CONTEXT = "default";
const TEMPORARY_DOCKER_DIRECTORY_PREFIX = join(tmpdir(), "aso-computacion-admin-prisma-test-");

const COMMAND_TIMEOUTS = {
  compose: 120_000,
  migration: 60_000,
  teardown: 60_000,
  vitest: 60_000,
};

const MANUAL_DOCKER_RECOVERY_COMMAND =
  "docker compose --project-name aso-computacion-admin-prisma-test -f docker-compose.test.yml down -v --remove-orphans";

function pickIntegrationEnvironment(environment) {
  return Object.fromEntries(
    INHERITED_ENVIRONMENT_KEYS.flatMap((key) =>
      environment[key] === undefined ? [] : [[key, environment[key]]],
    ),
  );
}

export function createIntegrationEnvironment(testDatabaseUrl, environment, temporaryDirectory) {
  assertSafePrismaTestTarget(testDatabaseUrl);

  if (environment.DOCKER_HOST) {
    throw new Error("DOCKER_HOST must not be configured for Prisma integration tests.");
  }

  return {
    ...pickIntegrationEnvironment(environment),
    DOCKER_CONFIG: temporaryDirectory,
    HOME: temporaryDirectory,
    DATABASE_URL: testDatabaseUrl,
    TEST_DATABASE_URL: testDatabaseUrl,
  };
}

function run(command, arguments_, environment, timeout, label, spawn, stdio = "inherit") {
  const result = spawn(command, arguments_, { env: environment, stdio, timeout });

  if (result.error) {
    if (result.error.code === "ETIMEDOUT") {
      throw new Error(`${label} timed out after ${timeout}ms. Check Docker and the isolated test environment.`);
    }

    throw new Error(`${label} could not start. Ensure its documented prerequisite is installed.`);
  }

  if (result.status !== 0) {
    throw new Error(`${label} failed (exit status ${result.status ?? "unknown"}).`);
  }

  return result;
}

function assertLocalDockerDaemon(environment, spawn) {
  const result = run(
    "docker",
    [
      "--context",
      LOCAL_DOCKER_CONTEXT,
      "context",
      "inspect",
      LOCAL_DOCKER_CONTEXT,
      "--format",
      "{{.Endpoints.docker.Host}}",
    ],
    environment,
    COMMAND_TIMEOUTS.compose,
    "Docker context inspection",
    spawn,
    "pipe",
  );
  const endpoint = String(result.stdout ?? "").trim();

  if (!endpoint.startsWith("unix://") && !endpoint.startsWith("npipe://")) {
    throw new Error("Docker default context must resolve to a local Unix socket or Windows named pipe.");
  }
}

export function runPrismaIntegrationTests(environment = process.env, dependencies = {}) {
  const spawn = dependencies.spawn ?? spawnSync;
  const createTemporaryDirectory =
    dependencies.createTemporaryDirectory ?? (() => mkdtempSync(TEMPORARY_DOCKER_DIRECTORY_PREFIX));
  const removeTemporaryDirectory =
    dependencies.removeTemporaryDirectory ??
    ((directory) => rmSync(directory, { force: true, recursive: true }));

  const temporaryDirectory = createTemporaryDirectory();
  try {
    const integrationEnvironment = createIntegrationEnvironment(
      environment.TEST_DATABASE_URL,
      environment,
      temporaryDirectory,
    );
    let composeAttempted = false;
    let failure;

    try {
      assertLocalDockerDaemon(integrationEnvironment, spawn);
      composeAttempted = true;
      run(
        "docker",
        [
          "--context",
          LOCAL_DOCKER_CONTEXT,
          "compose",
          "--project-name",
          COMPOSE_PROJECT_NAME,
          "-f",
          "docker-compose.test.yml",
          "up",
          "-d",
          "--wait",
        ],
        integrationEnvironment,
        COMMAND_TIMEOUTS.compose,
        "Docker Compose startup",
        spawn,
      );
      run(
        "npx",
        ["prisma", "migrate", "deploy"],
        integrationEnvironment,
        COMMAND_TIMEOUTS.migration,
        "Prisma migration",
        spawn,
      );
      run(
        "npx",
        ["vitest", "run", "--config", "vitest.integration.config.ts"],
        integrationEnvironment,
        COMMAND_TIMEOUTS.vitest,
        "Prisma integration Vitest",
        spawn,
      );
    } catch (error) {
      failure = error;
    }

    if (composeAttempted) {
      try {
        run(
          "docker",
          [
            "--context",
            LOCAL_DOCKER_CONTEXT,
            "compose",
            "--project-name",
            COMPOSE_PROJECT_NAME,
            "-f",
            "docker-compose.test.yml",
            "down",
            "-v",
            "--remove-orphans",
          ],
          integrationEnvironment,
          COMMAND_TIMEOUTS.teardown,
          "Docker Compose cleanup",
          spawn,
        );
      } catch (teardownError) {
        const recovery = ` Run \`${MANUAL_DOCKER_RECOVERY_COMMAND}\` manually to recover.`;

        if (failure) {
          throw new Error(`${failure.message} Cleanup also failed: ${teardownError.message}${recovery}`);
        }

        throw new Error(`${teardownError.message}${recovery}`);
      }
    }

    if (failure) {
      throw failure;
    }
  } finally {
    removeTemporaryDirectory(temporaryDirectory);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    runPrismaIntegrationTests();
  } catch (error) {
    console.error(`Prisma integration tests failed: ${error.message}`);
    process.exitCode = 1;
  }
}
