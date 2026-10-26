import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

import { createIntegrationEnvironment } from "./run-prisma-integration-tests.mjs";
import { assertSafePrismaTestTarget, CANONICAL_TEST_DATABASE_URL } from "./prisma-test-target.mjs";

// The same disposable Postgres as the integration tests (docker-compose.test.yml, canonical test URL only),
// under its own compose project so the two never share a volume.
const COMPOSE_PROJECT_NAME = "aso-computacion-admin-e2e";
const COMPOSE_ARGUMENTS = ["--context", "default", "compose", "--project-name", COMPOSE_PROJECT_NAME, "-f", "docker-compose.test.yml"];

// Test-only values, used when the caller (CI defines its own) does not set them. They guard nothing real.
const E2E_ADMIN_PASSWORD = "e2e-only-admin-password-0123456789";
const E2E_ADMIN_SECRET = "e2e-only-session-secret-0123456789-abcdefghij";

// Test-only: the e2e suite signs in with the emergency password (no real Google), so the editor sessions that
// prove the role rules are planted here, straight into the disposable database, and handed to Playwright as
// signed cookie values. Nothing in the app can create a session like this.
const E2E_EDITOR_EMAIL = "e2e-editor@example.org";

async function seedEditorSessions(databaseUrl, secret) {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
    const user = await prisma.user.create({ data: { id: "e2e-editor", email: E2E_EDITOR_EMAIL, name: "Editor E2E", role: "EDITOR" } });
    const sessions = [
      // Distinct user agents give each session its own label on the sessions page (Edge / Firefox; the admin's own is Chrome).
      { id: "e2e-editor-session", userAgent: "Mozilla/5.0 (X11; Linux x86_64) Edg/126.0" },
      { id: "e2e-editor-revoked", userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0" },
    ];
    const tokens = [];

    for (const { id, userAgent } of sessions) {
      await prisma.session.create({ data: { id, kind: "user", userId: user.id, createdAt: now, expiresAt, lastSeenAt: now, userAgent } });

      const issuedAt = Math.floor(now.getTime() / 1000);
      tokens.push(
        await new SignJWT({ sid: id, kind: "user", uid: user.id, role: "EDITOR" })
          .setProtectedHeader({ alg: "HS256" })
          .setSubject(user.id)
          .setIssuedAt(issuedAt)
          .setExpirationTime(issuedAt + 3600)
          .sign(new TextEncoder().encode(secret)),
      );
    }

    return { editorSession: tokens[0], revokableEditorSession: tokens[1] };
  } finally {
    await prisma.$disconnect();
  }
}

function run(command, arguments_, environment, label) {
  const result = spawnSync(command, arguments_, { env: environment, stdio: "inherit" });

  if (result.error || result.status !== 0) {
    throw new Error(`${label} failed${result.status === null ? "" : ` (exit status ${result.status})`}.`);
  }
}

export async function runE2e(environment = process.env) {
  const testDatabaseUrl = environment.TEST_DATABASE_URL ?? CANONICAL_TEST_DATABASE_URL;
  assertSafePrismaTestTarget(testDatabaseUrl);

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "aso-computacion-admin-e2e-"));
  // Docker and Prisma get the stripped environment of the integration runner. The app, the build and
  // the browser keep the real one (HOME holds the installed Chromium) plus the test-only values.
  const databaseEnvironment = createIntegrationEnvironment(testDatabaseUrl, environment, temporaryDirectory);
  const appEnvironment = {
    ...environment,
    // Next also loads `.env*` files, but never overrides a variable already set: blanking these keeps a
    // local run from triggering the real landing deploy or reporting test errors to Sentry.
    CLOUDFLARE_DEPLOY_HOOK_URL: "",
    SENTRY_DSN: "",
    NEXT_PUBLIC_SENTRY_DSN: "",
    SENTRY_AUTH_TOKEN: "",
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
    const { editorSession, revokableEditorSession } = await seedEditorSessions(testDatabaseUrl, appEnvironment.ADMIN_SECRET);
    appEnvironment.E2E_EDITOR_SESSION = editorSession;
    appEnvironment.E2E_REVOKABLE_EDITOR_SESSION = revokableEditorSession;
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
    await runE2e();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
