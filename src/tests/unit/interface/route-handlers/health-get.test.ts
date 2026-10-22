import { describe, expect, it } from "vitest";

import { GET } from "../../../../../app/api/health/route";

describe("GET /api/health", () => {
  it("returns 200 with a minimal ok body", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("sets Cache-Control: no-store", () => {
    const response = GET();

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("exposes no secrets or stack traces in the body", async () => {
    const response = GET();
    const text = await response.clone().text();

    expect(text).not.toMatch(/secret|password|stack|DATABASE_URL/i);
  });
});
