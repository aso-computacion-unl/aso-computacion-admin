import { SignJWT, decodeJwt } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { openRegistrationConfirmToken, sealRegistrationConfirmToken } from "@/infrastructure/registration/registration-confirm-token";

/* D9: the token names the attempt (a nonce) so a later registration of the same email can retire it. */
const SECRET = "r".repeat(40);
const NOW = new Date("2026-11-20T15:00:00.000Z");
const CLAIMS = { registrationId: "reg-1", eventId: "event-1" };

const signed = (payload: Record<string, unknown>) =>
  new SignJWT({ purpose: "registration-confirm", rid: "reg-1", eid: "event-1", ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(NOW.getTime() / 1000))
    .setExpirationTime(Math.floor(NOW.getTime() / 1000) + 48 * 3600)
    .sign(new TextEncoder().encode(SECRET));

beforeEach(() => {
  vi.stubEnv("REGISTRATION_CONFIRM_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("registration confirmation token: the attempt nonce", () => {
  it("signs the nonce into the token and reads it back", async () => {
    const token = await sealRegistrationConfirmToken({ ...CLAIMS, nonce: "attempt-7" }, NOW);

    expect(decodeJwt(token)).toMatchObject({ rid: "reg-1", eid: "event-1", nce: "attempt-7" });
    expect(await openRegistrationConfirmToken(token, NOW)).toEqual({ status: "valid", claims: { ...CLAIMS, nonce: "attempt-7" } });
  });

  it("opens a token without a nonce (a link sent before the change) as one that names no attempt", async () => {
    const result = await openRegistrationConfirmToken(await sealRegistrationConfirmToken(CLAIMS, NOW), NOW);

    expect(result).toEqual({ status: "valid", claims: CLAIMS });
    expect(result.status === "valid" && result.claims.nonce).toBeFalsy();
  });

  it("refuses a nonce that is not a non-empty string", async () => {
    for (const nce of [7, "", null, {}, ["a"]]) {
      expect(await openRegistrationConfirmToken(await signed({ nce }), NOW)).toEqual({ status: "invalid" });
    }
  });

  it("does not let the nonce be changed without the secret", async () => {
    const token = await sealRegistrationConfirmToken({ ...CLAIMS, nonce: "attempt-7" }, NOW);
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ ...decodeJwt(token), nce: "attempt-8" })).toString("base64url");

    expect(await openRegistrationConfirmToken(`${header}.${forgedPayload}.${signature}`, NOW)).toEqual({ status: "invalid" });
  });
});
