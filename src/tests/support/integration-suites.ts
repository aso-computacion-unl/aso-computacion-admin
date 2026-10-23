/**
 * Single list of Prisma integration suites. Both Vitest configs read it: the
 * default config excludes these files and the integration config includes
 * them, so a new suite is registered in exactly one place.
 */
export const INTEGRATION_SUITES: readonly string[] = [
  "src/tests/integration/infrastructure/event-prisma.repository.integration.test.ts",
  "src/tests/integration/infrastructure/faq-prisma.repository.integration.test.ts",
  "src/tests/integration/infrastructure/social-link-prisma.repository.integration.test.ts",
  "src/tests/integration/infrastructure/pillar-prisma.repository.integration.test.ts",
  "src/tests/integration/infrastructure/site-settings-prisma.repository.integration.test.ts",
  "src/tests/integration/infrastructure/board-member-prisma.repository.integration.test.ts",
  "src/tests/integration/infrastructure/login-rate-limiter.integration.test.ts",
  "src/tests/integration/infrastructure/login-throttle.integration.test.ts",
  "src/tests/integration/infrastructure/public-content.integration.test.ts",
  "src/tests/integration/infrastructure/seed-landing-content.integration.test.ts",
];
