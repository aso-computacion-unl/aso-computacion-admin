import { describe, expect, it } from "vitest";

import { ifNoneMatchMatches, strongEtag } from "@/infrastructure/http/etag";

describe("strongEtag", () => {
  it("is a quoted, strong (not W/) validator", () => {
    expect(strongEtag("{}")).toMatch(/^"[0-9a-f]{64}"$/);
  });

  it("is deterministic and changes with any byte of the body", () => {
    expect(strongEtag('{"a":1}')).toBe(strongEtag('{"a":1}'));
    expect(strongEtag('{"a":1}')).not.toBe(strongEtag('{"a":2}'));
  });
});

describe("ifNoneMatchMatches", () => {
  const etag = strongEtag("body");

  it("matches the same validator", () => {
    expect(ifNoneMatchMatches(etag, etag)).toBe(true);
  });

  it("matches inside a comma-separated list, ignoring spaces", () => {
    expect(ifNoneMatchMatches(`"other" , ${etag}`, etag)).toBe(true);
  });

  it("matches a weak form of the validator (If-None-Match uses weak comparison)", () => {
    expect(ifNoneMatchMatches(`W/${etag}`, etag)).toBe(true);
  });

  it("matches the wildcard", () => {
    expect(ifNoneMatchMatches("*", etag)).toBe(true);
  });

  it("does not match another validator, an unquoted lookalike, or a missing header", () => {
    expect(ifNoneMatchMatches('"other"', etag)).toBe(false);
    expect(ifNoneMatchMatches(etag.slice(1, -1), etag)).toBe(false);
    expect(ifNoneMatchMatches("", etag)).toBe(false);
    expect(ifNoneMatchMatches(null, etag)).toBe(false);
  });
});
