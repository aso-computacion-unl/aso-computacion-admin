import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { afterMock, recordMock } = vi.hoisted(() => ({ afterMock: vi.fn(), recordMock: vi.fn() }));

vi.mock("@/infrastructure/deploy/deploy-status", () => ({ recordDeployOutcome: recordMock }));

vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: afterMock }));

import {
  DEPLOY_HOOK_DEBOUNCE_MS,
  DEPLOY_HOOK_MAX_WAIT_MS,
  DEPLOY_HOOK_TIMEOUT_MS,
} from "@/infrastructure/deploy/deploy-hook";

// A fresh module per test: the pending rebuild and the "reported once" latches live in the module.
let requestSiteRebuild: typeof import("@/infrastructure/deploy/deploy-hook").requestSiteRebuild;

const HOOK_URL = "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/0123456789abcdef-secret-token";

let fetchMock: ReturnType<typeof vi.fn>;
let info: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

const logged = () => [...info.mock.calls, ...warn.mock.calls, ...error.mock.calls].flat().map(String).join("\n");

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  ({ requestSiteRebuild } = await import("@/infrastructure/deploy/deploy-hook"));
  afterMock.mockReset();
  recordMock.mockReset();
  recordMock.mockResolvedValue(undefined);
  fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CLOUDFLARE_DEPLOY_HOOK_URL", HOOK_URL);
  info = vi.spyOn(console, "info").mockImplementation(() => undefined);
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  error = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("requestSiteRebuild", () => {
  it("returns at once without calling the hook: the POST waits out the quiet window", async () => {
    requestSiteRebuild();

    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(DEPLOY_HOOK_DEBOUNCE_MS - 1);
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(HOOK_URL, expect.objectContaining({ method: "POST" }));
  });

  it("coalesces a burst of mutations into one build, fired after the last one goes quiet", async () => {
    // Three edits 4 s apart: the burst (8 s) ends before the max wait, so it is one build.
    for (let click = 0; click < 3; click += 1) {
      requestSiteRebuild();
      await vi.advanceTimersByTimeAsync(DEPLOY_HOOK_DEBOUNCE_MS / 2);
    }
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(DEPLOY_HOOK_DEBOUNCE_MS / 2);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fires again for a later, separate edit", async () => {
    requestSiteRebuild();
    await vi.advanceTimersByTimeAsync(DEPLOY_HOOK_DEBOUNCE_MS);
    requestSiteRebuild();
    await vi.advanceTimersByTimeAsync(DEPLOY_HOOK_DEBOUNCE_MS);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("is quiet longer than the edge cache of the public route (5 s), so the build never reads a stale copy", () => {
    expect(DEPLOY_HOOK_DEBOUNCE_MS).toBeGreaterThan(5_000);
  });

  it("skips with one log line, once per process, when the URL is unset", async () => {
    vi.stubEnv("CLOUDFLARE_DEPLOY_HOOK_URL", "");

    for (let i = 0; i < 4; i += 1) requestSiteRebuild();
    await vi.advanceTimersByTimeAsync(DEPLOY_HOOK_DEBOUNCE_MS * 2);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
    expect(String(info.mock.calls[0]?.[0])).toMatch(/CLOUDFLARE_DEPLOY_HOOK_URL/);
    expect(afterMock).not.toHaveBeenCalled();
  });

  it.each([
    ["http", "http://api.cloudflare.com/hook/abc"],
    ["a non-http scheme", "ftp://api.cloudflare.com/hook/abc"],
    ["a bare host", "api.cloudflare.com/hook/abc"],
    ["garbage", "not a url"],
  ])("refuses %s: never calls it, logs once and never prints the value", async (_label, value) => {
    vi.stubEnv("CLOUDFLARE_DEPLOY_HOOK_URL", value);

    requestSiteRebuild();
    requestSiteRebuild();
    await vi.advanceTimersByTimeAsync(DEPLOY_HOOK_DEBOUNCE_MS * 2);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    expect(logged()).toMatch(/https/);
    expect(logged()).not.toContain(value);
  });

  it("never throws, even when fetch throws synchronously, and logs without leaking the secret URL", async () => {
    fetchMock.mockImplementation(() => {
      throw new TypeError(`bad url ${HOOK_URL}`);
    });

    expect(() => requestSiteRebuild()).not.toThrow();
    await vi.advanceTimersByTimeAsync(DEPLOY_HOOK_DEBOUNCE_MS);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(logged()).not.toContain("secret-token");
  });

  it("logs a rejected request and an error status as warnings, never with the URL", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    requestSiteRebuild();
    await vi.advanceTimersByTimeAsync(DEPLOY_HOOK_DEBOUNCE_MS);

    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 403 }));
    requestSiteRebuild();
    await vi.advanceTimersByTimeAsync(DEPLOY_HOOK_DEBOUNCE_MS);

    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/network down/);
    expect(String(warn.mock.calls[1]?.[0])).toMatch(/403/);
    expect(logged()).not.toContain("secret-token");
  });

  it("gives up on a hook that never answers after a short timeout", async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
    );

    requestSiteRebuild();
    await vi.advanceTimersByTimeAsync(DEPLOY_HOOK_DEBOUNCE_MS);
    expect(warn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(DEPLOY_HOOK_TIMEOUT_MS);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(DEPLOY_HOOK_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
  });

  it("asks the platform to keep the invocation alive until the build has been requested", async () => {
    requestSiteRebuild();
    requestSiteRebuild();

    expect(afterMock).toHaveBeenCalledTimes(2);
    const [pending] = afterMock.mock.calls[0] as [Promise<void>];
    let settled = false;
    void pending.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(DEPLOY_HOOK_DEBOUNCE_MS - 1);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    expect(settled).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still schedules the build when after() is unavailable (outside a request)", async () => {
    afterMock.mockImplementation(() => {
      throw new Error("`after` was called outside a request scope");
    });

    expect(() => requestSiteRebuild()).not.toThrow();
    await vi.advanceTimersByTimeAsync(DEPLOY_HOOK_DEBOUNCE_MS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  describe("max wait", () => {
    it("is longer than the quiet window but leaves room for the hook call inside the 30 s admin function", () => {
      expect(DEPLOY_HOOK_MAX_WAIT_MS).toBeGreaterThan(DEPLOY_HOOK_DEBOUNCE_MS);
      expect(DEPLOY_HOOK_MAX_WAIT_MS).toBeLessThanOrEqual(15_000);
      expect(DEPLOY_HOOK_MAX_WAIT_MS + DEPLOY_HOOK_TIMEOUT_MS).toBeLessThan(30_000);
    });

    it("fires at the latest MAX_WAIT after the first edit of a burst that never goes quiet", async () => {
      const start = Date.now();
      const calledAt: number[] = [];
      fetchMock.mockImplementation(async () => {
        calledAt.push(Date.now() - start);
        return new Response(null, { status: 200 });
      });

      // An edit every 4 s keeps resetting the 8 s quiet window for a whole minute.
      for (let elapsed = 0; elapsed < 60_000; elapsed += 4_000) {
        requestSiteRebuild();
        await vi.advanceTimersByTimeAsync(4_000);
      }

      expect(calledAt[0]).toBe(DEPLOY_HOOK_MAX_WAIT_MS);
      // A new burst starts after each build, so the hook keeps being called during the long session.
      expect(calledAt.length).toBeGreaterThanOrEqual(3);
    });

    it("never holds an after() promise open longer than MAX_WAIT plus the hook call", async () => {
      const start = Date.now();
      const heldFor: number[] = [];

      for (let call = 0; call < 20; call += 1) {
        const registeredAt = Date.now() - start;
        requestSiteRebuild();
        const [held] = afterMock.mock.calls.at(-1) as [Promise<void>];
        void held.then(() => heldFor.push(Date.now() - start - registeredAt));
        await vi.advanceTimersByTimeAsync(4_000);
      }
      await vi.advanceTimersByTimeAsync(DEPLOY_HOOK_MAX_WAIT_MS + DEPLOY_HOOK_TIMEOUT_MS);

      expect(heldFor).toHaveLength(20);
      expect(Math.max(...heldFor)).toBeLessThanOrEqual(DEPLOY_HOOK_MAX_WAIT_MS + DEPLOY_HOOK_TIMEOUT_MS);
      expect(Math.max(...heldFor)).toBeLessThanOrEqual(DEPLOY_HOOK_MAX_WAIT_MS);
    });

    it("also bounds a slow hook: a build that never answers is given up on within MAX_WAIT plus the timeout", async () => {
      fetchMock.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
      );
      const start = Date.now();
      let heldFor = -1;

      requestSiteRebuild();
      const [first] = afterMock.mock.calls[0] as [Promise<void>];
      void first.then(() => (heldFor = Date.now() - start));

      // The burst keeps going every 5 s, so only the max wait can end it.
      for (let call = 0; call < 6; call += 1) {
        await vi.advanceTimersByTimeAsync(5_000);
        requestSiteRebuild();
      }
      await vi.advanceTimersByTimeAsync(DEPLOY_HOOK_TIMEOUT_MS);

      expect(heldFor).toBe(DEPLOY_HOOK_MAX_WAIT_MS + DEPLOY_HOOK_TIMEOUT_MS);
      expect(heldFor).toBeLessThan(30_000);
    });

    it("keeps the full quiet window for an isolated edit", async () => {
      requestSiteRebuild();
      await vi.advanceTimersByTimeAsync(DEPLOY_HOOK_DEBOUNCE_MS - 1);
      expect(fetchMock).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});

describe("deploy outcome recording", () => {
  const fire = async () => {
    requestSiteRebuild();
    await vi.advanceTimersByTimeAsync(DEPLOY_HOOK_DEBOUNCE_MS);
  };

  it("records a success with the HTTP status", async () => {
    await fire();

    expect(recordMock).toHaveBeenCalledTimes(1);
    expect(recordMock).toHaveBeenCalledWith({ ok: true, httpStatus: 200 });
  });

  it("records a rejection by the hook with its HTTP status", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    await fire();

    expect(recordMock).toHaveBeenCalledWith({ ok: false, httpStatus: 500 });
  });

  it("records a network failure as an error kind, never its message", async () => {
    fetchMock.mockRejectedValue(new TypeError(`fetch failed ${HOOK_URL}`));

    await fire();

    expect(recordMock).toHaveBeenCalledWith({ ok: false, errorKind: "network" });
  });

  it("records an aborted request as a timeout", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error("This operation was aborted"), { name: "AbortError" }));

    await fire();

    expect(recordMock).toHaveBeenCalledWith({ ok: false, errorKind: "timeout" });
  });

  it("never hands the hook URL to the recorder", async () => {
    for (const reply of [new Response(null, { status: 200 }), new Response(null, { status: 502 })]) {
      fetchMock.mockResolvedValueOnce(reply);
      await fire();
    }
    fetchMock.mockRejectedValueOnce(new TypeError(`fetch failed ${HOOK_URL}`));
    await fire();

    expect(JSON.stringify(recordMock.mock.calls)).not.toContain("secret-token");
  });

  it("records nothing when the hook is not configured", async () => {
    vi.stubEnv("CLOUDFLARE_DEPLOY_HOOK_URL", "");

    await fire();

    expect(recordMock).not.toHaveBeenCalled();
  });

  it("survives a recorder that throws: the build was requested and the invocation is released", async () => {
    recordMock.mockRejectedValue(new Error("db down"));
    requestSiteRebuild();
    const [settled] = afterMock.mock.calls[0] as [Promise<void>];

    await vi.advanceTimersByTimeAsync(DEPLOY_HOOK_DEBOUNCE_MS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(settled).resolves.toBeUndefined();
  });
});
