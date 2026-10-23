/**
 * Domain layer entry point.
 *
 * This layer holds content entities and their invariants. It must stay
 * framework-independent: no imports from `next/*`, the Prisma client, the
 * Cloudinary SDK, or `jose` are allowed here. See
 * `src/tests/unit/architecture-boundaries.test.ts`.
 */
export { DomainError, ValidationError } from "./domain-error";
