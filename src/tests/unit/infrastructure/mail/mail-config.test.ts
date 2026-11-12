import { describe, expect, it } from "vitest";

import { DEFAULT_MAIL_DAILY_LIMIT, GMAIL_SMTP_ENDPOINT, gmailConfig, mailConfigProblems, mailDailyLimit, registrationConfirmSecret, smtpEndpoint } from "@/infrastructure/mail/mail-config";

const ENV = {
  MAIL_GMAIL_USER: "asociacion@gmail.com",
  MAIL_GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
  REGISTRATION_CONFIRM_SECRET: "r".repeat(40),
  AUTH_URL: "https://admin.example.org",
  ADMIN_SECRET: "a".repeat(40),
  FORUM_SESSION_SECRET: "f".repeat(40),
};

describe("mail configuration", () => {
  it("is complete with the Gmail account, its app password and a long confirmation secret", () => {
    expect(mailConfigProblems(ENV)).toEqual([]);
    expect(gmailConfig(ENV)).toEqual({ user: "asociacion@gmail.com", appPassword: "abcdefghijklmnop", fromName: "ASO Computación" });
    expect(registrationConfirmSecret(ENV)).toBe("r".repeat(40));
  });

  it.each([
    ["MAIL_GMAIL_USER", { MAIL_GMAIL_USER: undefined }],
    ["MAIL_GMAIL_USER", { MAIL_GMAIL_USER: "  " }],
    ["MAIL_GMAIL_USER", { MAIL_GMAIL_USER: "sin-arroba" }],
    ["MAIL_GMAIL_USER", { MAIL_GMAIL_USER: "__REPLACE_MAIL_GMAIL_USER__" }],
    ["MAIL_GMAIL_APP_PASSWORD", { MAIL_GMAIL_APP_PASSWORD: undefined }],
    ["MAIL_GMAIL_APP_PASSWORD", { MAIL_GMAIL_APP_PASSWORD: "   " }],
    ["MAIL_GMAIL_APP_PASSWORD", { MAIL_GMAIL_APP_PASSWORD: "__REPLACE_MAIL_GMAIL_APP_PASSWORD__" }],
  ])("has no Gmail account and names only %s when it is missing or unusable", (name, override) => {
    const env = { ...ENV, ...override };

    expect(gmailConfig(env)).toBeNull();
    expect(mailConfigProblems(env)).toEqual([name]);
  });

  it.each([
    ["missing", undefined],
    ["a placeholder", "__REPLACE_REGISTRATION_CONFIRM_SECRET__"],
    ["shorter than 32 characters", "r".repeat(31)],
    ["the admin secret", ENV.ADMIN_SECRET],
    ["the forum secret", ENV.FORUM_SESSION_SECRET],
  ])("refuses a confirmation secret that is %s, and names only REGISTRATION_CONFIRM_SECRET", (_label, secret) => {
    const env = { ...ENV, REGISTRATION_CONFIRM_SECRET: secret };

    expect(registrationConfirmSecret(env)).toBeUndefined();
    expect(mailConfigProblems(env)).toEqual(["REGISTRATION_CONFIRM_SECRET"]);
  });

  it.each([undefined, "", "http://admin.example.org", "not a url"])("names AUTH_URL when the public origin that the links need is %j", (authUrl) => {
    expect(mailConfigProblems({ ...ENV, AUTH_URL: authUrl })).toEqual(["AUTH_URL"]);
  });

  it("lists every problem in a stable order, names only and never a value", () => {
    const problems = mailConfigProblems({ MAIL_GMAIL_APP_PASSWORD: "hunter2-hunter2", REGISTRATION_CONFIRM_SECRET: "short", MAIL_DAILY_LIMIT: "lots" });

    expect(problems).toEqual(["MAIL_GMAIL_USER", "REGISTRATION_CONFIRM_SECRET", "AUTH_URL", "MAIL_DAILY_LIMIT"]);
    expect(JSON.stringify(problems)).not.toMatch(/hunter2|short|lots/);
  });

  it("trims the sender name and uses MAIL_FROM_NAME when given; control characters never reach a header", () => {
    expect(gmailConfig({ ...ENV, MAIL_FROM_NAME: "  Asociación de Computación  " })?.fromName).toBe("Asociación de Computación");
    expect(gmailConfig({ ...ENV, MAIL_FROM_NAME: "Asociación\r\nBcc: x@y.z" })?.fromName).toBe("Asociación Bcc: x@y.z");
    expect(gmailConfig({ ...ENV, MAIL_FROM_NAME: "   " })?.fromName).toBe("ASO Computación");
  });

  describe("daily limit", () => {
    it("defaults to 400, leaving room under Gmail's own cap", () => {
      expect(DEFAULT_MAIL_DAILY_LIMIT).toBe(400);
      expect(mailDailyLimit({})).toBe(400);
      expect(mailDailyLimit({ MAIL_DAILY_LIMIT: "" })).toBe(400);
    });

    it("reads a positive whole number", () => {
      expect(mailDailyLimit({ MAIL_DAILY_LIMIT: "150" })).toBe(150);
      expect(mailDailyLimit({ MAIL_DAILY_LIMIT: " 1 " })).toBe(1);
      expect(mailConfigProblems({ ...ENV, MAIL_DAILY_LIMIT: "150" })).toEqual([]);
    });

    it.each(["0", "-5", "1.5", "lots", "1e3", "100001"])("falls back to the default and flags %j", (raw) => {
      const env = { ...ENV, MAIL_DAILY_LIMIT: raw };

      expect(mailDailyLimit(env)).toBe(400);
      expect(mailConfigProblems(env)).toEqual(["MAIL_DAILY_LIMIT"]);
    });
  });
});

describe("SMTP endpoint (MAIL_SMTP_*, test-only)", () => {
  it("is Gmail's SMTPS endpoint when nothing is set, whatever else the environment has", () => {
    expect(GMAIL_SMTP_ENDPOINT).toEqual({ host: "smtp.gmail.com", port: 465, secure: true });
    expect(smtpEndpoint({})).toEqual(GMAIL_SMTP_ENDPOINT);
    expect(smtpEndpoint(ENV)).toEqual(GMAIL_SMTP_ENDPOINT);
    expect(smtpEndpoint({ MAIL_SMTP_HOST: "", MAIL_SMTP_PORT: "", MAIL_SMTP_SECURE: "" })).toEqual(GMAIL_SMTP_ENDPOINT);
  });

  it("points at the host given, with a plain connection unless the port or MAIL_SMTP_SECURE say otherwise", () => {
    expect(smtpEndpoint({ MAIL_SMTP_HOST: "127.0.0.1", MAIL_SMTP_PORT: "2525" })).toEqual({ host: "127.0.0.1", port: 2525, secure: false });
    expect(smtpEndpoint({ MAIL_SMTP_HOST: " localhost ", MAIL_SMTP_PORT: " 2525 ", MAIL_SMTP_SECURE: "TRUE" })).toEqual({ host: "localhost", port: 2525, secure: true });
    expect(smtpEndpoint({ MAIL_SMTP_HOST: "mail.example.org" })).toEqual({ host: "mail.example.org", port: 465, secure: true });
    expect(smtpEndpoint({ MAIL_SMTP_HOST: "mail.example.org", MAIL_SMTP_PORT: "2465", MAIL_SMTP_SECURE: "true" })).toEqual({ host: "mail.example.org", port: 2465, secure: true });
  });

  it("allows a plain connection only to this machine: any other host without TLS keeps Gmail's endpoint", () => {
    // `localhost` is sent as the address itself, so no name lookup can point a plain connection elsewhere.
    expect(smtpEndpoint({ MAIL_SMTP_HOST: "LOCALHOST", MAIL_SMTP_PORT: "2525", MAIL_SMTP_SECURE: "false" })).toEqual({ host: "127.0.0.1", port: 2525, secure: false });
    expect(smtpEndpoint({ MAIL_SMTP_HOST: "127.0.0.53", MAIL_SMTP_PORT: "2525" })).toEqual({ host: "127.0.0.53", port: 2525, secure: false });
    // Not addresses: a resolver would look these up by name.
    expect(smtpEndpoint({ MAIL_SMTP_HOST: "127.999.1.1", MAIL_SMTP_PORT: "2525" })).toEqual(GMAIL_SMTP_ENDPOINT);
    expect(smtpEndpoint({ MAIL_SMTP_HOST: "127.0.0.01", MAIL_SMTP_PORT: "2525" })).toEqual(GMAIL_SMTP_ENDPOINT);
    expect(smtpEndpoint({ MAIL_SMTP_HOST: "127.0.0.1", MAIL_SMTP_SECURE: "false" })).toEqual({ host: "127.0.0.1", port: 465, secure: false });
    expect(smtpEndpoint({ MAIL_SMTP_HOST: "mail.example.org", MAIL_SMTP_SECURE: "false" })).toEqual(GMAIL_SMTP_ENDPOINT);
    expect(smtpEndpoint({ MAIL_SMTP_HOST: "mail.example.org", MAIL_SMTP_PORT: "587" })).toEqual(GMAIL_SMTP_ENDPOINT);
    expect(smtpEndpoint({ MAIL_SMTP_HOST: "127.0.0.1.example.org", MAIL_SMTP_PORT: "2525" })).toEqual(GMAIL_SMTP_ENDPOINT);
    expect(smtpEndpoint({ MAIL_SMTP_HOST: "10.0.0.5", MAIL_SMTP_PORT: "2525" })).toEqual(GMAIL_SMTP_ENDPOINT);
  });

  it.each([
    ["a port without a host", { MAIL_SMTP_PORT: "2525" }],
    ["a secure flag without a host", { MAIL_SMTP_SECURE: "false" }],
    ["a placeholder host", { MAIL_SMTP_HOST: "__REPLACE_MAIL_SMTP_HOST__" }],
    ["a host with a scheme", { MAIL_SMTP_HOST: "smtp://127.0.0.1" }],
    ["a host with a path or a space", { MAIL_SMTP_HOST: "127.0.0.1/x y" }],
    ["a host with a port inside", { MAIL_SMTP_HOST: "127.0.0.1:2525" }],
    ["a port of zero", { MAIL_SMTP_HOST: "127.0.0.1", MAIL_SMTP_PORT: "0" }],
    ["a port over 65535", { MAIL_SMTP_HOST: "127.0.0.1", MAIL_SMTP_PORT: "65536" }],
    ["a port that is not a number", { MAIL_SMTP_HOST: "127.0.0.1", MAIL_SMTP_PORT: "smtp" }],
    ["a fractional port", { MAIL_SMTP_HOST: "127.0.0.1", MAIL_SMTP_PORT: "25.5" }],
    ["a secure flag that is not true or false", { MAIL_SMTP_HOST: "127.0.0.1", MAIL_SMTP_PORT: "2525", MAIL_SMTP_SECURE: "maybe" }],
  ])("ignores the whole override and keeps Gmail's endpoint for %s", (_label, env) => {
    expect(smtpEndpoint(env)).toEqual(GMAIL_SMTP_ENDPOINT);
  });
});

