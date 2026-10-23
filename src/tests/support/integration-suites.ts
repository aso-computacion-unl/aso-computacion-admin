/**
 * Single list of Prisma integration suites. Both Vitest configs read it: the
 * default config excludes these files and the integration config includes
 * them, so a new suite is registered in exactly one place.
 */
export const INTEGRATION_SUITES: readonly string[] = [];
