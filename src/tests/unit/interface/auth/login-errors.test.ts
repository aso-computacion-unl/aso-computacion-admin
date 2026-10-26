import { describe, expect, it } from "vitest";

import { CONFIG_INCOMPLETE_MESSAGE, LOGIN_ERROR_MESSAGES, loginErrorMessage } from "@/interface/auth/login-errors";

describe("loginErrorMessage", () => {
  it("words every code the Google routes can send, the refusal without saying why", () => {
    expect(loginErrorMessage("denied")).toBe("Esta cuenta no tiene acceso.");
    expect(Object.keys(LOGIN_ERROR_MESSAGES).sort()).toEqual(["denied", "failed", "throttled", "unavailable"]);
  });

  it.each([undefined, "", "unknown", "toString", "__proto__", "constructor", ["denied"]])("says nothing for %j (the URL is user input)", (value) => {
    expect(loginErrorMessage(value)).toBeUndefined();
  });
});

describe("CONFIG_INCOMPLETE_MESSAGE", () => {
  it("says the configuration is incomplete without naming a variable or a value", () => {
    expect(CONFIG_INCOMPLETE_MESSAGE).toMatch(/configuración incompleta/i);
    expect(CONFIG_INCOMPLETE_MESSAGE).not.toMatch(/GOOGLE|AUTH_URL|SECRET/);
  });
});
