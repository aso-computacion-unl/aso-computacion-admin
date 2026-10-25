import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock("@sentry/nextjs", () => ({ captureException }));

import { reportError } from "@/infrastructure/observability/report-error";

beforeEach(() => {
  captureException.mockReset();
  vi.stubEnv("SENTRY_DSN", "");
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("reportError", () => {
  it("does nothing when no DSN is configured", () => {
    reportError(new Error("boom"));

    expect(captureException).not.toHaveBeenCalled();
  });

  it("sends the error with its context when SENTRY_DSN is set", () => {
    vi.stubEnv("SENTRY_DSN", "https://key@o1.ingest.sentry.io/2");
    const error = new Error("boom");

    reportError(error, { action: "createEvent" });

    expect(captureException).toHaveBeenCalledWith(error, { tags: { action: "createEvent" } });
  });

  it("also reports when only the public DSN is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://key@o1.ingest.sentry.io/2");

    reportError(new Error("boom"));

    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it("never throws, even when the SDK does", () => {
    vi.stubEnv("SENTRY_DSN", "https://key@o1.ingest.sentry.io/2");
    captureException.mockImplementation(() => {
      throw new Error("sdk broke");
    });

    expect(() => reportError(new Error("boom"))).not.toThrow();
  });
});
