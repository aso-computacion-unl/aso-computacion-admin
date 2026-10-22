import { describe, expect, it } from "vitest";
import { z } from "zod";

import { formatZodIssue } from "@/interface/errors/map-error-to-response";

function firstIssue(result: z.ZodSafeParseResult<unknown>): z.core.$ZodIssue {
  if (result.success) {
    throw new Error("expected parse failure");
  }

  return result.error.issues[0]!;
}

describe("formatZodIssue", () => {
  it("formats unrecognized_keys", () => {
    const schema = z.object({ name: z.string() }).strict();
    const result = schema.safeParse({ name: "A", foo: "x" });

    expect(formatZodIssue(firstIssue(result))).toBe("Unknown field: foo");
  });

  it("formats a page too_small error", () => {
    const schema = z.object({ page: z.coerce.number().int().min(1) });
    const result = schema.safeParse({ page: "0" });

    expect(formatZodIssue(firstIssue(result))).toBe("page must be a positive integer");
  });

  it("formats a page too_big error", () => {
    const schema = z.object({ page: z.coerce.number().int().min(1).max(100000) });
    const result = schema.safeParse({ page: "100001" });

    expect(formatZodIssue(firstIssue(result))).toBe("page must be between 1 and 100000");
  });

  it.each([
    ["too_small", { limit: "0" }],
    ["too_big", { limit: "200" }],
  ])("formats a limit %s error", (_label, input) => {
    const schema = z.object({ limit: z.coerce.number().int().min(1).max(100) });
    const result = schema.safeParse(input);

    expect(formatZodIssue(firstIssue(result))).toBe("limit must be between 1 and 100");
  });

  it("formats an id uuid format error", () => {
    const schema = z.object({ id: z.string().uuid() });
    const result = schema.safeParse({ id: "not-a-uuid" });

    expect(formatZodIssue(firstIssue(result))).toBe("id must be a valid UUID");
  });

  it("uses the issue message for a pathless custom refinement", () => {
    const schema = z.object({}).refine(() => false, { message: "At least one field is required" });
    const result = schema.safeParse({});

    expect(formatZodIssue(firstIssue(result))).toBe("At least one field is required");
  });

  it("falls back to the issue message for unmapped fields", () => {
    const schema = z.object({ other: z.string().min(1) });
    const result = schema.safeParse({ other: "" });

    expect(formatZodIssue(firstIssue(result))).toBe(firstIssue(result).message);
  });
});
