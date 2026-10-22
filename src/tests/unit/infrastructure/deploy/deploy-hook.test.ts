import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { afterMock } = vi.hoisted(() => ({ afterMock: vi.fn() }));

vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: afterMock }));

import {
  DEPLOY_HOOK_DEBOUNCE_MS,
  DEPLOY_HOOK_TIMEOUT_MS,
  requestSiteRebuild,
  resetDeployHookState,
} from "@/infrastructure/deploy/deploy-hook";

const HOOK_URL = "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/0123456789abcdef-secret-token";

let fetchMock: ReturnType<typeof vi.fn>;
let info: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

const logged = () => [...info.mock.calls, ...warn.mock.calls, ...error.mock.calls].flat().map(String).join("\n");

beforeEach(() => {
  vi.useFakeTimers();
  resetDeployHookState();
  afterMock.mockReset();
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
    for (let click = 0; click < 6; click += 1) {
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
});
