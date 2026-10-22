import { describe, expect, it } from "vitest";

import { HttpError } from "@/interface/errors/http-error";
import { parseBody } from "@/interface/validation/parse-body";

function mockRequest(body: string | null, headers: Record<string, string> = {}): Request {
  return {
    headers: new Headers(headers),
    json: async () => {
      if (body === null || body === "") {
        throw new SyntaxError("Unexpected end of JSON input");
      }

      return JSON.parse(body);
    },
  } as unknown as Request;
}

describe("parseBody", () => {
  it("returns the parsed object for a valid JSON body", async () => {
    const request = mockRequest('{"name":"Bread"}', { "Content-Type": "application/json" });

    const result = await parseBody(request);

    expect(result).toEqual({ name: "Bread" });
  });

  it("throws HttpError when Content-Type is missing", async () => {
    const request = mockRequest('{"name":"Bread"}');

    await expect(parseBody(request)).rejects.toThrow(HttpError);
    await expect(parseBody(request)).rejects.toThrow("Content-Type must be application/json");
  });

  it("throws HttpError for a non-JSON Content-Type", async () => {
    const request = mockRequest("Bread", { "Content-Type": "text/plain" });

    await expect(parseBody(request)).rejects.toThrow(HttpError);
    await expect(parseBody(request)).rejects.toThrow("Content-Type must be application/json");
  });

  it("throws HttpError for a malformed JSON body", async () => {
    const request = mockRequest("not json", { "Content-Type": "application/json" });

    await expect(parseBody(request)).rejects.toThrow(HttpError);
    await expect(parseBody(request)).rejects.toThrow("Request body is required");
  });

  it("throws HttpError for an empty body", async () => {
    const request = mockRequest(null, { "Content-Type": "application/json" });

    await expect(parseBody(request)).rejects.toThrow(HttpError);
    await expect(parseBody(request)).rejects.toThrow("Request body is required");
  });
});
