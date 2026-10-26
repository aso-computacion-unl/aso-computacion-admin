import { describe, expect, it } from "vitest";

import { describeUserAgent } from "@/interface/admin/sessions/user-agent";

describe("describeUserAgent", () => {
  it.each([
    ["Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36", "Chrome en Linux"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0", "Edge en Windows"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15", "Safari en macOS"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1", "Safari en iOS"],
    ["Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0", "Firefox en Android"],
    ["Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36 OPR/80.0", "Opera en Android"],
  ])("%s -> %s", (agent, expected) => {
    expect(describeUserAgent(agent)).toBe(expected);
  });

  it("falls back to a neutral label for an empty or unknown agent", () => {
    expect(describeUserAgent(null)).toBe("Dispositivo desconocido");
    expect(describeUserAgent("curl/8.0")).toBe("Dispositivo desconocido");
  });

  it("names only the browser or only the system when that is all it can tell", () => {
    expect(describeUserAgent("Firefox/127.0")).toBe("Firefox");
    expect(describeUserAgent("(X11; Linux x86_64)")).toBe("Linux");
  });
});
