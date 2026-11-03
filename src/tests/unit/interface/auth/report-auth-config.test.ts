import { beforeEach, describe, expect, it, vi } from "vitest";

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));

vi.mock("@/infrastructure/observability/report-error", () => ({ reportError }));

let reportAuthConfigProblems: typeof import("@/interface/auth/report-auth-config").reportAuthConfigProblems;

beforeEach(async () => {
  reportError.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  // The "already reported" memory is module state: a fresh module per test.
  vi.resetModules();
  ({ reportAuthConfigProblems } = await import("@/interface/auth/report-auth-config"));
});

describe("reportAuthConfigProblems", () => {
  it("reports an incomplete Google configuration once, naming only the variables", () => {
    reportAuthConfigProblems(["GOOGLE_CLIENT_SECRET", "AUTH_URL"]);
    reportAuthConfigProblems(["GOOGLE_CLIENT_SECRET", "AUTH_URL"]);

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("GOOGLE_CLIENT_SECRET, AUTH_URL") }), {
      action: "auth-config",
    });
  });

  it("reports again when the problem changes", () => {
    reportAuthConfigProblems(["AUTH_URL"]);
    reportAuthConfigProblems(["GOOGLE_CLIENT_ID"]);

    expect(reportError).toHaveBeenCalledTimes(2);
  });

  it("says nothing when the configuration is fine", () => {
    reportAuthConfigProblems([]);

    expect(reportError).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});
