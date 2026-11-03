import * as Sentry from "@sentry/nextjs";

/**
 * Reports an unexpected server-side error to Sentry. A no-op while no DSN is configured, and it never throws:
 * error tracking must not turn a handled failure into a second one. Call it next to the `console.error`
 * that already records the error, not instead of it.
 */
export function reportError(error: unknown, context?: Record<string, string>): void {
  if (!process.env.SENTRY_DSN?.trim() && !process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()) {
    return;
  }

  try {
    Sentry.captureException(error, context ? { tags: context } : undefined);
  } catch {
    // Reporting is best effort.
  }
}
