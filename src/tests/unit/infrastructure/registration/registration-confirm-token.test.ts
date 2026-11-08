import { SignJWT, decodeJwt } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { signForumSession } from "@/infrastructure/forum/forum-session-jwt";
import {
  REGISTRATION_CONFIRM_TTL_SECONDS,
  RegistrationConfirmSecretError,
  openRegistrationConfirmToken,
  sealRegistrationConfirmToken,
} from "@/infrastructure/registration/registration-confirm-token";

const SECRET = "r".repeat(40);
const NOW = new Date("2026-11-20T15:00:00.000Z");
const CLAIMS = { registrationId: "reg-1", eventId: "event-1" };
const HOUR = 3_600_000;

const signedWith = (secret: string, payload: Record<string, unknown>, expiresIn: string | number = "48h") =>
  new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt(Math.floor(NOW.getTime() / 1000)).setExpirationTime(typeof expiresIn === "number" ? expiresIn : Math.floor(NOW.getTime() / 1000) + 48 * 3600).sign(new TextEncoder().encode(secret));

beforeEach(() => {
  vi.stubEnv("REGISTRATION_CONFIRM_SECRET", SECRET);
  vi.stubEnv("ADMIN_SECRET", "a".repeat(40));
  vi.stubEnv("FORUM_SESSION_SECRET", "f".repeat(40));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("registration confirmation token", () => {
  it("round-trips the registration and event ids and expires 48 hours after it was issued", async () => {
    const token = await sealRegistrationConfirmToken(CLAIMS, NOW);
    const payload = decodeJwt(token);

    expect(REGISTRATION_CONFIRM_TTL_SECONDS).toBe(48 * 3600);
    expect(payload).toMatchObject({ purpose: "registration-confirm", rid: "reg-1", eid: "event-1", iat: NOW.getTime() / 1000, exp: NOW.getTime() / 1000 + 48 * 3600 });
    expect(await openRegistrationConfirmToken(token, NOW)).toEqual({ status: "valid", claims: CLAIMS });
    expect(await openRegistrationConfirmToken(token, new Date(NOW.getTime() + 48 * HOUR - 1000))).toMatchObject({ status: "valid" });
  });

  it("says expired once the 48 hours are over, and still invalid for anything that is not its token", async () => {
    const token = await sealRegistrationConfirmToken(CLAIMS, NOW);

    expect(await openRegistrationConfirmToken(token, new Date(NOW.getTime() + 48 * HOUR + 1000))).toEqual({ status: "expired" });
    expect(await openRegistrationConfirmToken(token.slice(0, -2) + "xx", NOW)).toEqual({ status: "invalid" });
  });

  it.each([undefined, "", "   ", "not-a-token", "a.b.c", "eyJhbGciOiJub25lIn0.e30."])("treats %j as invalid", async (value) => {
    expect(await openRegistrationConfirmToken(value, NOW)).toEqual({ status: "invalid" });
  });

  it("refuses a token signed with another secret, or without the right purpose, or with missing or wrong-typed claims", async () => {
    const claims = { purpose: "registration-confirm", rid: "reg-1", eid: "event-1" };

    expect(await openRegistrationConfirmToken(await signedWith("x".repeat(40), claims), NOW)).toEqual({ status: "invalid" });
    expect(await openRegistrationConfirmToken(await signedWith(SECRET, { ...claims, purpose: "forum-oauth-state" }), NOW)).toEqual({ status: "invalid" });
    expect(await openRegistrationConfirmToken(await signedWith(SECRET, { rid: "reg-1", eid: "event-1" }), NOW)).toEqual({ status: "invalid" });
    expect(await openRegistrationConfirmToken(await signedWith(SECRET, { ...claims, rid: 7 }), NOW)).toEqual({ status: "invalid" });
    expect(await openRegistrationConfirmToken(await signedWith(SECRET, { ...claims, eid: "" }), NOW)).toEqual({ status: "invalid" });
    expect(await openRegistrationConfirmToken(await signedWith(SECRET, claims), NOW)).toMatchObject({ status: "valid" });
  });

  it("is not a forum or admin token, and neither of those opens as one", async () => {
    const forum = await signForumSession({ sid: "s", memberId: "m" });

    expect(await openRegistrationConfirmToken(forum, new Date())).toEqual({ status: "invalid" });
    expect(await openRegistrationConfirmToken(await signedWith("f".repeat(40), { purpose: "registration-confirm", rid: "r", eid: "e" }), NOW)).toEqual({ status: "invalid" });
  });

  it("fails closed without a usable secret: it signs nothing and opens nothing", async () => {
    const token = await sealRegistrationConfirmToken(CLAIMS, NOW);

    for (const bad of [undefined, "", "short", "__REPLACE_REGISTRATION_CONFIRM_SECRET__", "a".repeat(40), "f".repeat(40)]) {
      vi.stubEnv("REGISTRATION_CONFIRM_SECRET", bad as string);

      await expect(sealRegistrationConfirmToken(CLAIMS, NOW)).rejects.toThrow(RegistrationConfirmSecretError);
      expect(await openRegistrationConfirmToken(token, NOW)).toEqual({ status: "invalid" });
    }
  });
});
