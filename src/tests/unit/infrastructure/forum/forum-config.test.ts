import { describe, expect, it } from "vitest";

import { googleConfig } from "@/infrastructure/auth/auth-config";
import { FORUM_GOOGLE_CALLBACK_PATH, forumAllowedDomain, forumConfigProblems, forumGoogleConfig, isForumEnabled } from "@/infrastructure/forum/forum-config";

const SECRET = "f".repeat(40);
const ENV = {
  FORUM_ALLOWED_EMAIL_DOMAIN: "unl.edu.ec",
  FORUM_SESSION_SECRET: SECRET,
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  AUTH_URL: "https://admin.example.org",
  ADMIN_SECRET: "a".repeat(40),
};

describe("forum configuration", () => {
  it("is enabled only with the domain, a long forum secret and a Google client", () => {
    expect(isForumEnabled(ENV)).toBe(true);
    expect(forumConfigProblems(ENV)).toEqual([]);
  });

  it.each([
    ["FORUM_ALLOWED_EMAIL_DOMAIN", { FORUM_ALLOWED_EMAIL_DOMAIN: undefined }],
    ["FORUM_ALLOWED_EMAIL_DOMAIN", { FORUM_ALLOWED_EMAIL_DOMAIN: "  " }],
    ["FORUM_SESSION_SECRET", { FORUM_SESSION_SECRET: undefined }],
    ["FORUM_SESSION_SECRET", { FORUM_SESSION_SECRET: "too-short" }],
    ["FORUM_SESSION_SECRET", { FORUM_SESSION_SECRET: "__REPLACE_FORUM_SESSION_SECRET__" }],
    ["FORUM_SESSION_SECRET", { FORUM_SESSION_SECRET: "a".repeat(40) }],
    ["GOOGLE_CLIENT_ID", { GOOGLE_CLIENT_ID: undefined }],
    ["GOOGLE_CLIENT_SECRET", { GOOGLE_CLIENT_SECRET: undefined }],
    ["AUTH_URL", { AUTH_URL: "http://admin.example.org" }],
  ])("fails closed and names only %s when it is missing or unusable", (name, override) => {
    const env = { ...ENV, ...override };

    expect(isForumEnabled(env)).toBe(false);
    expect(forumGoogleConfig(env)).toBeNull();
    expect(forumConfigProblems(env)).toEqual([name]);
  });

  it("refuses the admin secret as the forum secret, so one leak cannot sign both", () => {
    expect(isForumEnabled({ ...ENV, FORUM_SESSION_SECRET: ENV.ADMIN_SECRET })).toBe(false);
  });

  it("normalises the allowed domain", () => {
    expect(forumAllowedDomain({ FORUM_ALLOWED_EMAIL_DOMAIN: " @UNL.edu.ec " })).toBe("unl.edu.ec");
    expect(forumAllowedDomain({})).toBeUndefined();
  });

  it("uses the admin's Google client and its own redirect URI by default", () => {
    expect(forumGoogleConfig(ENV)).toEqual({ clientId: "client-id", clientSecret: "client-secret", redirectUri: `https://admin.example.org${FORUM_GOOGLE_CALLBACK_PATH}` });
    expect(FORUM_GOOGLE_CALLBACK_PATH).toBe("/foro/auth/google/callback");
    // The admin's own redirect URI is untouched.
    expect(googleConfig(ENV)?.redirectUri).toBe("https://admin.example.org/auth/google/callback");
  });

  it("takes a separate client when both FORUM_GOOGLE_* are set, and ignores a half pair", () => {
    expect(forumGoogleConfig({ ...ENV, FORUM_GOOGLE_CLIENT_ID: "forum-id", FORUM_GOOGLE_CLIENT_SECRET: "forum-secret" })).toMatchObject({ clientId: "forum-id", clientSecret: "forum-secret" });
    expect(forumGoogleConfig({ ...ENV, FORUM_GOOGLE_CLIENT_ID: "forum-id" })).toMatchObject({ clientId: "client-id" });
  });
});
