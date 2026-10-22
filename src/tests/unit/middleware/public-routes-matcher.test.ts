import { describe, expect, it } from "vitest";

import { config } from "../../../../middleware";
import { matcherCovers } from "./support";

describe("middleware matcher: public routes", () => {
  it.each(["/api/health", "/api/public/events", "/api/public/site", "/api/public/content"])(
    "PUB-MW: matcher does not intercept %s",
    (path) => {
      expect(matcherCovers(config.matcher, path)).toBe(false);
    },
  );

  it("PUB-MW: a lookalike path does not widen the /admin allowlist", () => {
    expect(matcherCovers(config.matcher, "/administrator")).toBe(false);
  });
});
