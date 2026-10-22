/**
 * Application layer entry point.
 *
 * This layer holds use cases and ports (repositories, media storage) that
 * orchestrate domain behavior. It must stay framework-independent: no
 * imports from `next/*`, the Prisma client, the Cloudinary SDK, or `jose`
 * are allowed here. See `src/tests/unit/architecture-boundaries.test.ts`.
 */
export { NotFoundError } from "./use-cases/use-case-error";
export type {
  ImageUploadFile,
  MediaStoragePort,
  UploadOptions,
  UploadResult,
} from "./ports/media-storage.port";
export { UploadImageUseCase } from "./use-cases/upload-image.use-case";
export type { UploadImageInput } from "./use-cases/upload-image.use-case";
