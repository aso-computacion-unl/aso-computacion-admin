import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { signSession, verifySession } from "@/infrastructure/auth/session-jwt";
import { FORUM_SESSION_DURATION_SECONDS, ForumSecretError, signForumSession, verifyForumSession } from "@/infrastructure/forum/forum-session-jwt";
import { openForumOAuthState, sealForumOAuthState } from "@/infrastructure/forum/forum-oauth-state";

const ADMIN_SECRET = "a".repeat(40);
const FORUM_SECRET = "f".repeat(40);

const claims = { sid: "session-1", memberId: "member-1" };
const forgedWith = (secret: string, payload: Record<string, unknown>, subject = "member-1") =>
  new SignJWT(payload).setSubject(subject).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));

beforeEach(() => {
  vi.stubEnv("ADMIN_SECRET", ADMIN_SECRET);
  vi.stubEnv("FORUM_SESSION_SECRET", FORUM_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("forum session token", () => {
  it("round-trips the session and member ids, with a seven day lifetime", async () => {
    const result = await verifyForumSession(await signForumSession(claims));

    expect(result).toMatchObject({ valid: true, payload: { sid: "session-1", memberId: "member-1" } });
    expect(FORUM_SESSION_DURATION_SECONDS).toBe(7 * 24 * 60 * 60);
  });

  it("fails closed without a usable forum secret, for signing and for verifying", async () => {
    const token = await signForumSession(claims);

    for (const bad of [undefined, "", "short", ADMIN_SECRET, "__REPLACE_FORUM_SESSION_SECRET__"]) {
      vi.stubEnv("FORUM_SESSION_SECRET", bad as string);

      await expect(signForumSession(claims)).rejects.toThrow(ForumSecretError);
      await expect(verifyForumSession(token)).rejects.toThrow(ForumSecretError);
    }
  });

  it.each([
    ["no token", ""],
    ["garbage", "not-a-jwt"],
  ])("rejects %s", async (_label, token) => {
    expect(await verifyForumSession(token)).toMatchObject({ valid: false });
  });

  it("rejects a token signed with another secret, and an unsigned one", async () => {
    expect(await verifyForumSession(await forgedWith("x".repeat(40), { sid: "s", mid: "member-1", typ: "forum-session", aud: "aso-computacion-forum" }))).toMatchObject({ valid: false, reason: "invalid" });
    const unsigned = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from('{"sid":"s"}').toString("base64url")}.`;
    expect(await verifyForumSession(unsigned)).toMatchObject({ valid: false });
  });

  it("rejects an expired token", async () => {
    vi.useFakeTimers();
    const token = await signForumSession(claims);
    vi.setSystemTime(Date.now() + (FORUM_SESSION_DURATION_SECONDS + 60) * 1000);

    expect(await verifyForumSession(token)).toMatchObject({ valid: false, reason: "expired" });
    vi.useRealTimers();
  });

  it("rejects well-signed tokens with the wrong claims", async () => {
    const base = { sid: "s", mid: "member-1", typ: "forum-session", aud: "aso-computacion-forum" };

    for (const payload of [{ ...base, sid: undefined }, { ...base, mid: undefined }, { ...base, mid: "other" }, { ...base, typ: "x" }, { ...base, aud: "someone" }]) {
      expect(await verifyForumSession(await forgedWith(FORUM_SECRET, payload))).toMatchObject({ valid: false, reason: "bad-claims" });
    }
  });
});

describe("forum and admin tokens stay apart", () => {
  it("a forum token is not an admin session, even when both were signed with the same secret", async () => {
    // Production refuses equal secrets; this proves the claims alone also keep the tokens apart.
    const forumToken = await forgedWith(ADMIN_SECRET, { sid: "s", mid: "member-1", typ: "forum-session", aud: "aso-computacion-forum" });

    expect(await verifySession(forumToken)).toMatchObject({ valid: false, reason: "bad-claims" });
    expect(await verifySession(await signForumSession(claims))).toMatchObject({ valid: false, reason: "invalid" });
  });

  it("an admin session token is not a forum session, signed with either secret", async () => {
    const adminToken = await signSession({ sid: "s1", kind: "user", uid: "user-1", role: "ADMIN" });
    const adminClaimsUnderForumSecret = await forgedWith(FORUM_SECRET, { sid: "s1", kind: "user", uid: "user-1", role: "ADMIN" }, "user-1");

    expect(await verifyForumSession(adminToken)).toMatchObject({ valid: false });
    expect(await verifyForumSession(adminClaimsUnderForumSecret)).toMatchObject({ valid: false, reason: "bad-claims" });
  });

  it("an OAuth flow token is not a session in either direction", async () => {
    const flow = await sealForumOAuthState({ state: "st", codeVerifier: "cv", nonce: "no" });

    expect(await verifyForumSession(flow)).toMatchObject({ valid: false });
    expect(await openForumOAuthState(await signForumSession(claims))).toBeNull();
  });
});

describe("forum OAuth state", () => {
  const flow = { state: "st", codeVerifier: "cv", nonce: "no" };

  it("round-trips and never opens a forged, foreign-secret or missing value", async () => {
    const sealed = await sealForumOAuthState(flow);

    expect(await openForumOAuthState(sealed)).toEqual(flow);
    expect(await openForumOAuthState(`${sealed}x`)).toBeNull();
    expect(await openForumOAuthState(undefined)).toBeNull();
    expect(await openForumOAuthState(await forgedWith(ADMIN_SECRET, { purpose: "forum-oauth-state", ...flow }))).toBeNull();
  });

  it("is not opened as the admin's OAuth flow, nor the admin's flow as the forum's", async () => {
    const { openOAuthState, sealOAuthState } = await import("@/infrastructure/auth/oauth-state");

    expect(await openOAuthState(await sealForumOAuthState(flow))).toBeNull();
    expect(await openForumOAuthState(await sealOAuthState(flow))).toBeNull();
  });
});
