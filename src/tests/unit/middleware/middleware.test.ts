import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { config } from "../../../../middleware";
import { TEST_SECRET, buildRequest } from "./support";

// A fresh middleware module per test: the session secret "reported once" latch lives in the module graph.
let middleware: typeof import("../../../../middleware").middleware;

beforeEach(async () => {
  vi.resetModules();
  ({ middleware } = await import("../../../../middleware"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("middleware auth boundary", () => {
  it("redirects missing and invalid document sessions to /login", async () => {
    vi.stubEnv("ADMIN_SECRET", TEST_SECRET);

    for (const path of ["/", "/admin", "/admin/events"]) {
      for (const cookieValue of [undefined, "invalid"]) {
        const response = await middleware(buildRequest(path, cookieValue));

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("http://localhost:3000/login");
      }
    }
  });

  it("returns JSON 401 for missing and invalid API sessions", async () => {
    vi.stubEnv("ADMIN_SECRET", TEST_SECRET);

    for (const cookieValue of [undefined, "invalid"]) {
      const response = await middleware(buildRequest("/api/admin/example", cookieValue));

      expect(response.status).toBe(401);
      expect(response.headers.get("content-type")).toContain("application/json");
      await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    }
  });

  it("returns an HTML 503 document when the session secret is unavailable", async () => {
    vi.stubEnv("ADMIN_SECRET", undefined);

    const response = await middleware(buildRequest("/admin"));

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("text/html");
    await expect(response.text()).resolves.toContain("Service unavailable");
  });

  it("returns JSON 503 for API requests when the session secret is unavailable", async () => {
    vi.stubEnv("ADMIN_SECRET", undefined);

    const response = await middleware(buildRequest("/api/admin/example"));

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ error: "Service unavailable" });
  });

  it("leaves /login outside the protected matcher", () => {
    expect(config.matcher).not.toContain("/login");
  });
});
