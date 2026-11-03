import { describe, expect, it } from "vitest";

import { describeError, toSafeError } from "@/infrastructure/observability/safe-error";

class PrismaLikeError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly meta: object,
  ) {
    super(message);
  }
}

const leaky = () => new PrismaLikeError('Invalid `create()` invocation: data: { name: "Ana Pérez", email: "ana@example.com" }', "P2002", { target: ["ana@example.com"] });

describe("describeError", () => {
  it("is the class and the code, nothing from the message", () => {
    expect(describeError(leaky())).toBe("PrismaLikeError P2002");
    expect(describeError(leaky())).not.toMatch(/Ana|ana@/);
  });

  it("is only the class when there is no code", () => {
    expect(describeError(new TypeError("Cannot read ana@example.com"))).toBe("TypeError");
  });

  it("ignores a code that is not a short identifier, because it could carry text", () => {
    expect(describeError(Object.assign(new Error("x"), { code: "ana@example.com wrote this" }))).toBe("Error");
    expect(describeError(Object.assign(new Error("x"), { code: 42 }))).toBe("Error");
  });

  it("does not trust a thrown value that is not an error", () => {
    expect(describeError("ana@example.com")).toBe("string");
    expect(describeError(null)).toBe("null");
    expect(describeError({ email: "ana@example.com" })).toBe("Object");
  });
});

describe("toSafeError", () => {
  it("keeps the type, the code and the stack frames, and drops the message and every extra property", () => {
    const original = leaky();
    const safe = toSafeError(original);

    expect(safe).toBeInstanceOf(Error);
    expect(safe.message).toBe("PrismaLikeError P2002");
    expect(safe.name).toBe("PrismaLikeError");
    expect(Object.keys(safe)).toEqual([]);
    expect(safe.stack).toContain("safe-error.test.ts");
    expect(JSON.stringify([safe.message, safe.name, safe.stack])).not.toMatch(/Ana|ana@|Invalid/);
    expect(safe.stack!.split("\n")[0]).toBe("PrismaLikeError: PrismaLikeError P2002");
  });

  it("gives a stack of its own when the thrown value had none", () => {
    expect(toSafeError("ana@example.com").message).toBe("string");
  });
});
