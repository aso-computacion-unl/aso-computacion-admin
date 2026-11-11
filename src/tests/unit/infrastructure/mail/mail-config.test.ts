import { describe, expect, it } from "vitest";

import { DEFAULT_MAIL_DAILY_LIMIT, gmailConfig, mailConfigProblems, mailDailyLimit, registrationConfirmSecret } from "@/infrastructure/mail/mail-config";

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
