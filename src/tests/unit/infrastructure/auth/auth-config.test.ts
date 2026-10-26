import { describe, expect, it } from "vitest";

import { allowedEmailDomain, bootstrapEmails, googleConfig, isBreakGlassEnabled, isGoogleConfigured } from "@/infrastructure/auth/auth-config";

const GOOGLE = { GOOGLE_CLIENT_ID: "id.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "secret", AUTH_URL: "https://admin.example.org" };

describe("isGoogleConfigured / googleConfig", () => {
  it("needs the client id, the client secret and the public base URL", () => {
    expect(isGoogleConfigured(GOOGLE)).toBe(true);
    expect(isGoogleConfigured({ ...GOOGLE, GOOGLE_CLIENT_ID: undefined })).toBe(false);
    expect(isGoogleConfigured({ ...GOOGLE, GOOGLE_CLIENT_SECRET: " " })).toBe(false);
    expect(isGoogleConfigured({ ...GOOGLE, AUTH_URL: undefined })).toBe(false);
    expect(isGoogleConfigured({})).toBe(false);
  });

  it("treats the .env.example placeholders as not configured", () => {
    expect(isGoogleConfigured({ ...GOOGLE, GOOGLE_CLIENT_ID: "__REPLACE_GOOGLE_CLIENT_ID__" })).toBe(false);
    expect(isGoogleConfigured({ ...GOOGLE, GOOGLE_CLIENT_SECRET: "__REPLACE_GOOGLE_CLIENT_SECRET__" })).toBe(false);
  });

  it.each(["not a url", "ftp://admin.example.org", "http://admin.example.org"])("rejects the base URL %j (https only, except localhost)", (AUTH_URL) => {
    expect(isGoogleConfigured({ ...GOOGLE, AUTH_URL })).toBe(false);
  });

  it("allows plain http on localhost for development", () => {
    expect(isGoogleConfigured({ ...GOOGLE, AUTH_URL: "http://localhost:3000" })).toBe(true);
    expect(isGoogleConfigured({ ...GOOGLE, AUTH_URL: "http://127.0.0.1:3000" })).toBe(true);
  });

  it("builds the redirect URI from the base URL, ignoring a trailing slash and any path", () => {
    expect(googleConfig({ ...GOOGLE, AUTH_URL: "https://admin.example.org/" })?.redirectUri).toBe("https://admin.example.org/auth/google/callback");
    expect(googleConfig({})).toBeNull();
  });
});

describe("isBreakGlassEnabled", () => {
  it("is on while Google is not configured, so local development and today's production keep a login", () => {
    expect(isBreakGlassEnabled({})).toBe(true);
  });

  it("is off once Google is configured, unless the flag is exactly 1", () => {
    expect(isBreakGlassEnabled(GOOGLE)).toBe(false);
    expect(isBreakGlassEnabled({ ...GOOGLE, BREAK_GLASS_PASSWORD_LOGIN: "1" })).toBe(true);
    expect(isBreakGlassEnabled({ ...GOOGLE, BREAK_GLASS_PASSWORD_LOGIN: "true" })).toBe(false);
    expect(isBreakGlassEnabled({ ...GOOGLE, BREAK_GLASS_PASSWORD_LOGIN: "0" })).toBe(false);
  });
});

describe("bootstrapEmails / allowedEmailDomain", () => {
  it("splits the comma separated list, trimming and dropping empties", () => {
    expect(bootstrapEmails({ ADMIN_BOOTSTRAP_EMAILS: " a@x.org, ,B@x.org ,," })).toEqual(["a@x.org", "B@x.org"]);
    expect(bootstrapEmails({})).toEqual([]);
  });

  it("reads the optional domain", () => {
    expect(allowedEmailDomain({ ALLOWED_EMAIL_DOMAIN: " unl.edu.ec " })).toBe("unl.edu.ec");
    expect(allowedEmailDomain({ ALLOWED_EMAIL_DOMAIN: " " })).toBeUndefined();
  });
});
