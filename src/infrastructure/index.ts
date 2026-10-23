/**
 * Infrastructure layer entry point.
 *
 * This layer hosts adapters that talk to Prisma/Postgres, Cloudinary, and the
 * session token library. Every module added under this layer that must never
 * reach a client component MUST start with `import "server-only";` as its
 * first statement.
 */
export {};
