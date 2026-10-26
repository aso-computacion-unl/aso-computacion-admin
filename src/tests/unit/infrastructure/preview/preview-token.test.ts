import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signSession } from "@/infrastructure/auth/session-jwt";
import {
  PREVIEW_TOKEN_TTL_SECONDS,
  PreviewSecretError,
  signPreviewToken,
  verifyPreviewToken,
} from "@/infrastructure/preview/preview-token";

const ADMIN_SECRET = "a".repeat(40);
const PREVIEW_SECRET = "p".repeat(40);
const NOW = new Date("2026-11-02T13:00:00.000Z");
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);
const forgedWith = (secret: string, claims: { aud?: string; iss?: string } = { aud: "aso-public-preview", iss: "aso-admin" }, ttl = "1h") =>
  new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setAudience(claims.aud ?? "x").setIssuer(claims.iss ?? "x").setIssuedAt().setExpirationTime(ttl).sign(new TextEncoder().encode(secret));

beforeEach(() => {
  vi.stubEnv("ADMIN_SECRET", ADMIN_SECRET);
  vi.stubEnv("PREVIEW_TOKEN_SECRET", PREVIEW_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("signPreviewToken", () => {
  it("offers only the three lifetimes the admin menu has: 1 hour, 24 hours and 7 days", () => {
    expect(PREVIEW_TOKEN_TTL_SECONDS).toEqual({ "1h": 3600, "24h": 86400, "7d": 604800 });
  });

  it("returns the token with the exact instant it stops working", async () => {
    const { token, expiresAt } = await signPreviewToken("24h", NOW);

    expect(expiresAt.toISOString()).toBe("2026-11-03T13:00:00.000Z");
    expect(token.split(".")).toHaveLength(3);
  });

  it("refuses a lifetime that is not on the menu", async () => {
    await expect(signPreviewToken("30d" as "7d", NOW)).rejects.toThrow(/lifetime/);
  });

  it("fails closed without a usable PREVIEW_TOKEN_SECRET: missing, placeholder, short, or shared with another secret", async () => {
    vi.stubEnv("FORUM_SESSION_SECRET", "f".repeat(40));

    for (const bad of [undefined, "", "short", "__REPLACE_PREVIEW_TOKEN_SECRET__", ADMIN_SECRET, "f".repeat(40)]) {
      vi.stubEnv("PREVIEW_TOKEN_SECRET", bad as string);

      await expect(signPreviewToken("1h", NOW)).rejects.toThrow(PreviewSecretError);
    }
  });
});

describe("verifyPreviewToken", () => {
  it("accepts a token it signed, while it has not expired", async () => {
    const { token } = await signPreviewToken("1h", NOW);

    expect(await verifyPreviewToken(token, at(1000))).toBe(true);
  });

  it("is valid one second before expiry and expired from the expiry instant", async () => {
    const { token, expiresAt } = await signPreviewToken("1h", NOW);

    expect(await verifyPreviewToken(token, new Date(expiresAt.getTime() - 1000))).toBe(true);
    expect(await verifyPreviewToken(token, expiresAt)).toBe(false);
    expect(await verifyPreviewToken(token, at(8 * 24 * 3600 * 1000))).toBe(false);
  });

  it("rejects a token signed with another secret, including the admin session secret", async () => {
    expect(await verifyPreviewToken(await forgedWith("x".repeat(40)), NOW)).toBe(false);
    expect(await verifyPreviewToken(await forgedWith(ADMIN_SECRET), NOW)).toBe(false);
  });

  it("rejects an admin session cookie used as a preview token", async () => {
    const session = await signSession({ sid: "s1", kind: "user", uid: "u1", role: "ADMIN" });

    expect(await verifyPreviewToken(session, NOW)).toBe(false);
  });

  it("rejects a correctly signed token meant for something else (wrong audience or issuer)", async () => {
    expect(await verifyPreviewToken(await forgedWith(PREVIEW_SECRET, { aud: "other", iss: "aso-admin" }), new Date())).toBe(false);
    expect(await verifyPreviewToken(await forgedWith(PREVIEW_SECRET, { aud: "aso-public-preview", iss: "other" }), new Date())).toBe(false);
  });

  it("rejects a token that lives longer than the longest menu lifetime", async () => {
    expect(await verifyPreviewToken(await forgedWith(PREVIEW_SECRET, undefined, "30d"), new Date())).toBe(false);
  });

  it("rejects a tampered payload or signature, an unsigned token and garbage", async () => {
    const { token } = await signPreviewToken("1h", new Date());
    const [header, payload, signature] = token.split(".") as [string, string, string];
    const longer = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), exp: 9_999_999_999 })).toString("base64url");
    const unsigned = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${payload}.`;

    for (const forged of [`${header}.${longer}.${signature}`, `${header}.${payload}.${signature.slice(0, -2)}AA`, unsigned, "not-a-token", "", "a.b.c"]) {
      expect(await verifyPreviewToken(forged, new Date())).toBe(false);
    }
  });

  it("verifies nothing while the secret is not configured, even a token signed earlier", async () => {
    const { token } = await signPreviewToken("1h", new Date());
    vi.stubEnv("PREVIEW_TOKEN_SECRET", "");

    expect(await verifyPreviewToken(token, new Date())).toBe(false);
  });
});
