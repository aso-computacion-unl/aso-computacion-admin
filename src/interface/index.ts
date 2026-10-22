/**
 * Interface layer entry point.
 *
 * This layer holds Next.js-facing DTOs, mappers, and validation schemas that
 * translate between the application layer and the App Router (pages, route
 * handlers, server actions).
 */
export { HttpError } from "./errors/http-error";
export { formatZodIssue, mapErrorToResponse } from "./errors/map-error-to-response";
export { parseFormData } from "./validation/parse-form-data";
export type { ParseFormDataOptions } from "./validation/parse-form-data";
