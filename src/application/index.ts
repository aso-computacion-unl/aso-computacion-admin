/**
 * Application layer entry point.
 *
 * This layer holds use cases and ports (repositories, media storage) that
 * orchestrate domain behavior. It must stay framework-independent: no
 * imports from `next/*`, the Prisma client, the Cloudinary SDK, or `jose`
 * are allowed here. See `src/tests/unit/architecture-boundaries.test.ts`.
 */
export { NotFoundError } from "./use-cases/use-case-error";
