import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { TURNSTILE_SITEVERIFY_URL, turnstileSiteKey, verifyTurnstile } from "@/infrastructure/http/turnstile";

const SECRET = "secret-key-for-tests";
const answer = (body: unknown, status = 200) => vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("verifyTurnstile", () => {
  it("is valid when Cloudflare says the token is, and sends the secret and the token as a form", async () => {
    const fetchMock = answer({ success: true });

    expect(await verifyTurnstile("token-1", { env: { TURNSTILE_SECRET_KEY: SECRET }, fetch: fetchMock })).toBe("valid");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(TURNSTILE_SITEVERIFY_URL);
    expect(init.method).toBe("POST");
    expect(Object.fromEntries(new URLSearchParams(init.body))).toEqual({ secret: SECRET, response: "token-1" });
  });

  it("is invalid for a rejected token, without a token, with a blank one, or one that is far too long, and never calls Cloudflare for the last three", async () => {
    const fetchMock = answer({ success: false, "error-codes": ["invalid-input-response"] });
    const options = { env: { TURNSTILE_SECRET_KEY: SECRET }, fetch: fetchMock };

    expect(await verifyTurnstile("bad", options)).toBe("invalid");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    for (const token of [undefined, "", "   ", "x".repeat(2049), 42 as unknown as string]) {
      expect(await verifyTurnstile(token, options)).toBe("invalid");
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed when Cloudflare cannot be reached, answers an error, or answers nonsense", async () => {
    const options = (fetch: typeof globalThis.fetch) => ({ env: { TURNSTILE_SECRET_KEY: SECRET }, fetch });

    expect(await verifyTurnstile("t", options(vi.fn().mockRejectedValue(new Error("network"))))).toBe("unavailable");
    expect(await verifyTurnstile("t", options(answer({ success: true }, 500)))).toBe("unavailable");
    expect(await verifyTurnstile("t", options(vi.fn().mockResolvedValue(new Response("<html>", { status: 200 }))))).toBe("unavailable");
    expect(await verifyTurnstile("t", options(answer({ success: false, "error-codes": ["invalid-input-secret"] })))).toBe("unavailable");
  });

  it("fails closed in production when the secret is missing, empty or a placeholder, without calling Cloudflare", async () => {
    const fetchMock = answer({ success: true });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    for (const secret of [undefined, "", "  ", "__REPLACE_TURNSTILE_SECRET_KEY__"]) {
      expect(await verifyTurnstile("t", { env: { NODE_ENV: "production", TURNSTILE_SECRET_KEY: secret }, fetch: fetchMock })).toBe("unavailable");
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips the check outside production when no secret is configured, so local development works", async () => {
    const fetchMock = answer({ success: false });

    expect(await verifyTurnstile(undefined, { env: { NODE_ENV: "development" }, fetch: fetchMock })).toBe("valid");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("turnstileSiteKey", () => {
  it("is the public site key the widget needs, trimmed", () => {
    expect(turnstileSiteKey({ TURNSTILE_SITE_KEY: " 0x4AAAAAAAbcdEF-_12 " })).toBe("0x4AAAAAAAbcdEF-_12");
  });

  it("is undefined when it is missing, blank, a placeholder or not shaped like a key", () => {
    for (const value of [undefined, "", "   ", "__REPLACE_TURNSTILE_SITE_KEY__", "key with spaces", '"><script>', "a".repeat(101)]) {
      expect(turnstileSiteKey({ TURNSTILE_SITE_KEY: value })).toBeUndefined();
    }
  });
});
