import { SignJWT, decodeJwt } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { signForumSession } from "@/infrastructure/forum/forum-session-jwt";
import {
  REGISTRATION_CANCEL_TTL_SECONDS,
  openRegistrationCancelToken,
  sealRegistrationCancelToken,
} from "@/infrastructure/registration/registration-cancel-token";
import { RegistrationConfirmSecretError, openRegistrationConfirmToken, sealRegistrationConfirmToken } from "@/infrastructure/registration/registration-confirm-token";

/*
 * D7: the cancellation link of the emails. Same secret as the confirmation link, its own purpose: a cancel token never
 * confirms and a confirm token never cancels.
 */
const SECRET = "r".repeat(40);
const NOW = new Date("2026-11-20T15:00:00.000Z");
const CLAIMS = { registrationId: "reg-1", eventId: "event-1" };
const DAY = 24 * 3_600_000;

const signedWith = (secret: string, payload: Record<string, unknown>) =>
  new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt(Math.floor(NOW.getTime() / 1000)).setExpirationTime(Math.floor(NOW.getTime() / 1000) + 3600).sign(new TextEncoder().encode(secret));

beforeEach(() => {
  vi.stubEnv("REGISTRATION_CONFIRM_SECRET", SECRET);
  vi.stubEnv("ADMIN_SECRET", "a".repeat(40));
  vi.stubEnv("FORUM_SESSION_SECRET", "f".repeat(40));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("registration cancellation token", () => {
  it("round-trips the registration and event ids and lives a year", async () => {
    const token = await sealRegistrationCancelToken(CLAIMS, NOW);

    expect(REGISTRATION_CANCEL_TTL_SECONDS).toBe(365 * 24 * 3600);
    expect(decodeJwt(token)).toMatchObject({ purpose: "registration-cancel", rid: "reg-1", eid: "event-1", exp: NOW.getTime() / 1000 + 365 * 24 * 3600 });
    expect(await openRegistrationCancelToken(token, NOW)).toEqual({ status: "valid", claims: CLAIMS });
    expect(await openRegistrationCancelToken(token, new Date(NOW.getTime() + 365 * DAY - 1000))).toMatchObject({ status: "valid" });
  });

  it("says expired once the year is over", async () => {
    const token = await sealRegistrationCancelToken(CLAIMS, NOW);

    expect(await openRegistrationCancelToken(token, new Date(NOW.getTime() + 365 * DAY + 1000))).toEqual({ status: "expired" });
  });

  it("says invalid for a tampered token, a token signed with another secret and anything that is not a token", async () => {
    const token = await sealRegistrationCancelToken(CLAIMS, NOW);
    const [head, body, signature] = token.split(".") as [string, string, string];
    const other = Buffer.from(JSON.stringify({ ...decodeJwt(token), rid: "reg-2" })).toString("base64url");

    expect(await openRegistrationCancelToken(token.slice(0, -2) + "xx", NOW)).toEqual({ status: "invalid" });
    expect(await openRegistrationCancelToken(`${head}.${other}.${signature}`, NOW)).toEqual({ status: "invalid" });
    expect(body).not.toBe(other);
    expect(await openRegistrationCancelToken(await signedWith("x".repeat(40), { purpose: "registration-cancel", rid: "r", eid: "e" }), NOW)).toEqual({ status: "invalid" });

    for (const value of [undefined, "", "   ", "not-a-token", "a.b.c", "eyJhbGciOiJub25lIn0.e30."]) {
      expect(await openRegistrationCancelToken(value, NOW), String(value)).toEqual({ status: "invalid" });
    }
  });

  it("refuses missing or wrong-typed claims", async () => {
    const claims = { purpose: "registration-cancel", rid: "reg-1", eid: "event-1" };

    expect(await openRegistrationCancelToken(await signedWith(SECRET, { rid: "reg-1", eid: "event-1" }), NOW)).toEqual({ status: "invalid" });
    expect(await openRegistrationCancelToken(await signedWith(SECRET, { ...claims, rid: 7 }), NOW)).toEqual({ status: "invalid" });
    expect(await openRegistrationCancelToken(await signedWith(SECRET, { ...claims, eid: "" }), NOW)).toEqual({ status: "invalid" });
    expect(await openRegistrationCancelToken(await signedWith(SECRET, claims), NOW)).toMatchObject({ status: "valid" });
  });

  it("is not opened by a confirmation token, a forum session, or any token with another purpose", async () => {
    const confirm = await sealRegistrationConfirmToken(CLAIMS, NOW);
    const forum = await signForumSession({ sid: "s", memberId: "m" });

    expect(await openRegistrationCancelToken(confirm, NOW)).toEqual({ status: "invalid" });
    expect(await openRegistrationCancelToken(forum, new Date())).toEqual({ status: "invalid" });
    expect(await openRegistrationCancelToken(await signedWith(SECRET, { purpose: "forum-oauth-state", rid: "r", eid: "e" }), NOW)).toEqual({ status: "invalid" });
  });

  it("does not open as a confirmation token either", async () => {
    const cancel = await sealRegistrationCancelToken(CLAIMS, NOW);

    expect(await openRegistrationConfirmToken(cancel, NOW)).toEqual({ status: "invalid" });
  });

  it("fails closed without a usable secret: it signs nothing and opens nothing", async () => {
    const token = await sealRegistrationCancelToken(CLAIMS, NOW);

    for (const bad of [undefined, "", "short", "__REPLACE_REGISTRATION_CONFIRM_SECRET__", "a".repeat(40), "f".repeat(40)]) {
      vi.stubEnv("REGISTRATION_CONFIRM_SECRET", bad as string);

      await expect(sealRegistrationCancelToken(CLAIMS, NOW)).rejects.toThrow(RegistrationConfirmSecretError);
      expect(await openRegistrationCancelToken(token, NOW)).toEqual({ status: "invalid" });
    }
  });
});
