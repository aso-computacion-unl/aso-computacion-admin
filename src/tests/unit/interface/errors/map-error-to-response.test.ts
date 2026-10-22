import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ValidationError } from "@/domain";
import { HttpError } from "@/interface/errors/http-error";
import { mapErrorToResponse } from "@/interface/errors/map-error-to-response";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mapErrorToResponse", () => {
  it.each([["Event not found"], ["Faq not found"]])(
    "maps a NotFoundError to a 404 response using its own message (%s)",
    async (message) => {
      const response = mapErrorToResponse(new NotFoundError(message));

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: message });
    },
  );

  it("maps a ZodError to a 400 response using the first formatted issue", async () => {
    const schema = z.object({ limit: z.coerce.number().int().min(1).max(100) });
    const result = schema.safeParse({ limit: "0" });
    if (result.success) {
      throw new Error("expected parse failure");
    }

    const response = mapErrorToResponse(result.error);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "limit must be between 1 and 100" });
  });

  it("maps a domain ValidationError to a 400 response with its message", async () => {
    const response = mapErrorToResponse(new ValidationError("title", "title is required"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "title is required" });
  });

  it("maps an HttpError to its own status code", async () => {
    const response = mapErrorToResponse(new HttpError(422, "Unprocessable"));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "Unprocessable" });
  });

  it("maps an unknown error to a 500 response and logs it", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = mapErrorToResponse(new Error("boom"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
