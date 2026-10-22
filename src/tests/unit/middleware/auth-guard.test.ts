import { afterEach, describe, expect, it, vi } from "vitest";

import { resetSessionSecretMisconfigurationReport } from "@/infrastructure/auth/session-jwt";
import { config, middleware } from "../../../../middleware";
import { TEST_SECRET, buildRequest, matcherCovers, signTestToken } from "./support";

describe("middleware auth guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetSessionSecretMisconfigurationReport();
  });

  it("MW-001: request without cookie to /admin redirects to /login", async () => {
    vi.stubEnv("ADMIN_SECRET", TEST_SECRET);

    const response = await middleware(buildRequest("/admin"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("MW-002: valid cookie to /admin passes through", async () => {
    vi.stubEnv("ADMIN_SECRET", TEST_SECRET);
    const token = await signTestToken(86400);

    const response = await middleware(buildRequest("/admin", token));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("MW-003: expired cookie to /admin redirects to /login", async () => {
    vi.stubEnv("ADMIN_SECRET", TEST_SECRET);
    const expiredToken = await signTestToken(-100);

    const response = await middleware(buildRequest("/admin", expiredToken));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("MW-004: a token signed with another secret is rejected", async () => {
    vi.stubEnv("ADMIN_SECRET", TEST_SECRET);
    const forgedToken = await signTestToken(86400, "y".repeat(32));

    const response = await middleware(buildRequest("/admin", forgedToken));

    expect(response.status).toBe(307);
  });

  it("MW-005: a valid cookie to a protected API path passes through", async () => {
    vi.stubEnv("ADMIN_SECRET", TEST_SECRET);
    const token = await signTestToken(86400);

    const response = await middleware(buildRequest("/api/admin/example", token));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("returns 503 and reports an invalid ADMIN_SECRET once without exposing it", async () => {
    const invalidSecret = "  __REPLACE_ADMIN_SECRET__  ";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("ADMIN_SECRET", invalidSecret);

    const response = await middleware(buildRequest("/api/admin/example", "invalid"));
    const responseText = await response.clone().text();
    const secondResponse = await middleware(buildRequest("/api/admin/example", "invalid"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Service unavailable" });
    expect(responseText).not.toContain(invalidSecret);
    expect(secondResponse.status).toBe(503);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith("ADMIN_SECRET is invalid; authentication is unavailable.");
    expect(errorSpy.mock.calls.flat()).not.toContain(invalidSecret);
  });

  it("MW-008: a too-short ADMIN_SECRET returns 503 and is never echoed", async () => {
    const invalidSecret = "too-short-secret";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("ADMIN_SECRET", invalidSecret);

    const response = await middleware(buildRequest("/admin", "invalid"));

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain(invalidSecret);
    expect(errorSpy.mock.calls.flat()).not.toContain(invalidSecret);
  });

  it("MW-009: a missing ADMIN_SECRET returns 503 instead of unauthorized", async () => {
    vi.stubEnv("ADMIN_SECRET", undefined);

    const response = await middleware(buildRequest("/api/admin/example"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Service unavailable" });
  });

  it("MW-006: the matcher protects the post-login landing route / and every /admin path", () => {
    for (const path of ["/", "/admin", "/admin/events", "/admin/events/123/edit"]) {
      expect(matcherCovers(config.matcher, path), path).toBe(true);
    }
  });

  it("MW-007: the matcher leaves /login and static assets alone", () => {
    for (const path of ["/login", "/_next/static/chunk.js", "/favicon.ico"]) {
      expect(matcherCovers(config.matcher, path), path).toBe(false);
    }
  });
});
