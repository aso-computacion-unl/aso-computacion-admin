import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));

vi.mock("@/infrastructure/observability/report-error", () => ({ reportError }));

import { ValidationError } from "@/domain";
import { mapActionError } from "@/interface/admin/action-result";
import { mapErrorToResponse } from "@/interface/errors/map-error-to-response";

beforeEach(() => {
  reportError.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("unexpected errors reach the error tracker", () => {
  it("reports the error a server action could not explain, next to the log line", () => {
    const error = new Error("db down");

    expect(mapActionError(error)).toEqual({ error: expect.any(String) });
    expect(console.error).toHaveBeenCalledWith(error);
    expect(reportError).toHaveBeenCalledWith(error);
  });

  it("reports the error an API handler answered with a 500", () => {
    const error = new Error("db down");

    expect(mapErrorToResponse(error).status).toBe(500);
    expect(reportError).toHaveBeenCalledWith(error);
  });

  it("does not report what the user caused (validation)", () => {
    mapActionError(new ValidationError("title", "title is required"));
    mapErrorToResponse(new ValidationError("title", "title is required"));

    expect(reportError).not.toHaveBeenCalled();
  });
});
