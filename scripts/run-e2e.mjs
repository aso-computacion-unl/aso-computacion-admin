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
const E2E_FORUM_DOMAIN = "unl.edu.ec";
const E2E_ADMIN_SECRET = "e2e-only-session-secret-0123456789-abcdefghij";

// Every variable that switches a feature on, by name (the full list the app reads, besides the test-only values
// below). Next loads `.env*` files for each variable the process does not already define, so the developer's own
// config would otherwise reach the build: Google sign-in folds the password form under "Acceso de emergencia",
// a forum domain turns the forum login on, an AUTH_URL adds registration links, and so on. The specs describe
// a server with none of them, so each is set to "" (the app treats empty as unset, and Next never overrides it).
const FEATURE_VARIABLES = [
  // Admin sign-in: Google, the emergency password, who may enter.
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "AUTH_URL",
  "BREAK_GLASS_PASSWORD_LOGIN",
  "ADMIN_BOOTSTRAP_EMAILS",
  "ALLOWED_EMAIL_DOMAIN",
  // Forum login (the domain and the session secret are handled separately: the caller opts in to the signed-in suite).
  "FORUM_GOOGLE_CLIENT_ID",
  "FORUM_GOOGLE_CLIENT_SECRET",
  // Captcha, uploads, scheduled rebuilds, signed preview links, cross-origin reads.
  "TURNSTILE_SECRET_KEY",
  "TURNSTILE_SITE_KEY",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_FOLDER",
  "CRON_SECRET",
  "PREVIEW_TOKEN_SECRET",
  "PUBLIC_CORS_ORIGINS",
  // The real landing deploy and error reporting.
  "CLOUDFLARE_DEPLOY_HOOK_URL",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "SENTRY_AUTH_TOKEN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
  "SENTRY_TRACES_SAMPLE_RATE",
  "NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE",
];

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

// `playwrightArguments` go straight to `playwright test` (a file, `-g <title>`), so one spec can run against the same build.
export async function runE2e(environment = process.env, playwrightArguments = []) {
  const testDatabaseUrl = environment.TEST_DATABASE_URL ?? CANONICAL_TEST_DATABASE_URL;
  assertSafePrismaTestTarget(testDatabaseUrl);

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "aso-computacion-admin-e2e-"));
  // Docker and Prisma get the stripped environment of the integration runner. The app, the build and
  // the browser keep the real one (HOME holds the installed Chromium) plus the test-only values.
  const databaseEnvironment = createIntegrationEnvironment(testDatabaseUrl, environment, temporaryDirectory);
  const appEnvironment = {
    ...environment,
    ...Object.fromEntries(FEATURE_VARIABLES.map((name) => [name, ""])),
    // Opt-in: the signed-in forum specs run only when the caller supplies a secret, never one from a `.env*` file.
    // With it, the members' domain is set too (registering for an event with a UNL account needs it); the login
    // itself stays off, because there is no Google client, so forum.spec.ts still sees "unavailable".
    FORUM_SESSION_SECRET: environment.FORUM_SESSION_SECRET ?? "",
    FORUM_ALLOWED_EMAIL_DOMAIN: environment.FORUM_SESSION_SECRET ? E2E_FORUM_DOMAIN : "",
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
    run("npx", ["playwright", "test", ...playwrightArguments], appEnvironment, "Playwright");
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
    await runE2e(process.env, process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
