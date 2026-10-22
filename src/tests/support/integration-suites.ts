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
];
