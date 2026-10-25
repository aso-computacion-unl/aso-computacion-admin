import { describe, expect, it } from "vitest";

import { buildSentryOptions, DEFAULT_TRACES_SAMPLE_RATE, parseTracesSampleRate } from "@/infrastructure/observability/sentry-options";
import { scrubSentryEvent } from "@/infrastructure/observability/sentry-scrub";

describe("parseTracesSampleRate", () => {
  it("defaults to a low rate when unset, blank or not a number", () => {
    for (const raw of [undefined, "", "  ", "abc"]) expect(parseTracesSampleRate(raw)).toBe(DEFAULT_TRACES_SAMPLE_RATE);
    expect(DEFAULT_TRACES_SAMPLE_RATE).toBe(0.1);
  });

  it("takes an override and clamps it to 0..1", () => {
    expect(parseTracesSampleRate("0.5")).toBe(0.5);
    expect(parseTracesSampleRate("0")).toBe(0);
    expect(parseTracesSampleRate("7")).toBe(1);
    expect(parseTracesSampleRate("-1")).toBe(0);
  });
});

describe("buildSentryOptions", () => {
  it("is disabled, with no DSN, when none is configured", () => {
    for (const dsn of [undefined, "", "   "]) {
      expect(buildSentryOptions(dsn, undefined)).toMatchObject({ dsn: undefined, enabled: false });
    }
  });

  it("enables the SDK for a DSN and never sends PII", () => {
    const options = buildSentryOptions(" https://key@o1.ingest.sentry.io/2 ", "0.25");

    expect(options).toMatchObject({ dsn: "https://key@o1.ingest.sentry.io/2", enabled: true, sendDefaultPii: false, tracesSampleRate: 0.25 });
  });

  it("scrubs errors and transactions before they are sent", () => {
    const options = buildSentryOptions("https://key@o1.ingest.sentry.io/2", undefined);

    expect(options.beforeSend).toBe(scrubSentryEvent);
    expect(options.beforeSendTransaction).toBe(scrubSentryEvent);
  });
});
