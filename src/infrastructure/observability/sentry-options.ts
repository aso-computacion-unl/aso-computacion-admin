import { scrubSentryEvent } from "./sentry-scrub";

/** Share of requests traced when `SENTRY_TRACES_SAMPLE_RATE` does not say otherwise: low, to stay inside the free quota. */
export const DEFAULT_TRACES_SAMPLE_RATE = 0.1;

export function parseTracesSampleRate(raw: string | undefined): number {
  const rate = raw?.trim() ? Number(raw) : Number.NaN;

  return Number.isFinite(rate) ? Math.min(1, Math.max(0, rate)) : DEFAULT_TRACES_SAMPLE_RATE;
}

/**
 * The one set of `Sentry.init` options shared by the server, edge and browser configs. Without a DSN the SDK
 * is disabled: it never opens a connection and `enabled` is false, so an unconfigured environment (local
 * development, CI, a build) is untouched. `sendDefaultPii` stays off and `scrubSentryEvent` runs on everything sent.
 */
export function buildSentryOptions(dsn: string | undefined, tracesSampleRate: string | undefined) {
  const trimmedDsn = dsn?.trim() || undefined;

  return {
    dsn: trimmedDsn,
    enabled: trimmedDsn !== undefined,
    sendDefaultPii: false,
    tracesSampleRate: parseTracesSampleRate(tracesSampleRate),
    beforeSend: scrubSentryEvent,
    beforeSendTransaction: scrubSentryEvent,
  };
}
