import { afterAll, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("server-only", () => ({}));

// Installs the explicit-pool client; must stay above the client import below.
import "./prisma-integration-client";
import { prisma } from "@/infrastructure/prisma/client";

import { INTEGRATION_SUITES } from "./integration-suites";
import { createPrismaIntegrationCleanup } from "./prisma-integration-cleanup";
import { assertNoFocusedOrSkippedIntegrationTests } from "./prisma-integration-test-contract";

const REPOSITORY_ROOT = join(__dirname, "..", "..", "..");

for (const suite of INTEGRATION_SUITES) {
  assertNoFocusedOrSkippedIntegrationTests(readFileSync(join(REPOSITORY_ROOT, suite), "utf8"));
}

/**
 * Wipes every content table before each integration test. Each test that
 * needs a row creates it directly; no test may rely on seeded rows.
 * Add every new model's `deleteMany()` here.
 */
beforeEach(async () => {
  await createPrismaIntegrationCleanup(process.env.TEST_DATABASE_URL, process.env.DATABASE_URL, () =>
    // Photos cascade from their event, but delete them explicitly so cleanup never depends on the FK.
    prisma.$transaction([prisma.eventPhoto.deleteMany(), prisma.event.deleteMany(), prisma.faq.deleteMany(), prisma.socialLink.deleteMany(), prisma.pillar.deleteMany(), prisma.siteSettings.deleteMany(), prisma.boardMember.deleteMany(), prisma.loginAttempt.deleteMany()]),
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
