import { readFileSync } from "node:fs";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { runMock, reportErrorMock } = vi.hoisted(() => ({ runMock: vi.fn(), reportErrorMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/infrastructure/observability/report-error", () => ({ reportError: reportErrorMock }));
vi.mock("@/interface/cron/scheduled-rebuild-container", () => ({ getRebuildOnWindowCrossing: () => ({ execute: runMock }) }));

const SECRET = "c".repeat(40);
const URL = "https://admin.test/api/cron/scheduled-rebuild";

let route: typeof import("../../../../../app/api/cron/scheduled-rebuild/route");

const get = (authorization?: string) => new NextRequest(URL, { headers: authorization === undefined ? {} : { authorization } });

beforeEach(async () => {
  runMock.mockReset();
  runMock.mockResolvedValue({ crossed: 0, outcome: "not-needed" });
  reportErrorMock.mockReset();
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.resetModules();
  route = await import("../../../../../app/api/cron/scheduled-rebuild/route");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/cron/scheduled-rebuild", () => {
  it("refuses a request with no secret, a wrong one or another scheme: 401, nothing run, not cacheable", async () => {
    for (const authorization of [undefined, "", "Bearer", `Bearer ${SECRET}x`, `Bearer ${SECRET.slice(1)}`, `Bearer ${"d".repeat(40)}`, `Basic ${SECRET}`, SECRET]) {
      const response = await route.GET(get(authorization));

      expect(response.status, String(authorization)).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }

    expect(runMock).not.toHaveBeenCalled();
  });

  it("refuses everything, even the secret-looking header, while CRON_SECRET is unset, empty, a placeholder or too short", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    for (const value of [undefined, "", "__REPLACE_CRON_SECRET__", "short"]) {
      vi.stubEnv("CRON_SECRET", value as string);

      for (const authorization of [undefined, `Bearer ${value}`, "Bearer undefined", "Bearer "]) {
        expect((await route.GET(get(authorization))).status).toBe(401);
      }
    }

    expect(runMock).not.toHaveBeenCalled();
  });

  it("does not take the secret from the URL", async () => {
    expect((await route.GET(new NextRequest(`${URL}?secret=${SECRET}&token=${SECRET}`))).status).toBe(401);
    expect(runMock).not.toHaveBeenCalled();
  });

  it("with the secret, asks the use case once, at the current time, and says nothing was needed", async () => {
    const before = Date.now();
    const response = await route.GET(get(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ crossed: 0, outcome: "not-needed" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(runMock).toHaveBeenCalledTimes(1);
    expect(runMock.mock.calls[0]![0].getTime()).toBeGreaterThanOrEqual(before);
  });

  it("answers 200 when a rebuild was requested or the hook is disabled, and 502 when the hook failed so the cron shows red", async () => {
    runMock.mockResolvedValueOnce({ crossed: 2, outcome: "triggered" });
    expect((await route.GET(get(`Bearer ${SECRET}`))).status).toBe(200);

    runMock.mockResolvedValueOnce({ crossed: 1, outcome: "disabled" });
    expect((await route.GET(get(`Bearer ${SECRET}`))).status).toBe(200);

    runMock.mockResolvedValueOnce({ crossed: 1, outcome: "failed" });
    const failed = await route.GET(get(`Bearer ${SECRET}`));

    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ crossed: 1, outcome: "failed" });
  });

  it("answers an unexpected failure with a generic 500 that leaks nothing, reported without the secret", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    runMock.mockRejectedValue(new Error("connect ECONNREFUSED postgres://user:secret@db/aso"));

    const response = await route.GET(get(`Bearer ${SECRET}`));
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toEqual({ error: "Service unavailable" });
    expect(reportErrorMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify([...vi.mocked(console.error).mock.calls, ...reportErrorMock.mock.calls])).not.toContain(SECRET);
  });

  it("is rendered per request and only reads: GET is the only verb", () => {
    expect(route.dynamic).toBe("force-dynamic");
    expect(Object.keys(route).filter((name) => /^[A-Z]+$/.test(name))).toEqual(["GET"]);
  });
});

describe("vercel.json cron", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: { path: string; schedule: string }[] };

  it("calls the scheduled-rebuild route, which exists", () => {
    expect(config.crons.map((cron) => cron.path)).toEqual(["/api/cron/scheduled-rebuild"]);
    expect(() => readFileSync("app/api/cron/scheduled-rebuild/route.ts", "utf8")).not.toThrow();
  });

  it("runs often enough for scheduled content to appear within a quarter of an hour: a valid 5-field schedule firing at least every 15 minutes", () => {
    const [minute, ...rest] = config.crons[0]!.schedule.split(" ");

    expect(rest).toEqual(["*", "*", "*", "*"]);
    expect(minute).toMatch(/^\*\/(1|2|3|5|10|15)$/);
  });
});
