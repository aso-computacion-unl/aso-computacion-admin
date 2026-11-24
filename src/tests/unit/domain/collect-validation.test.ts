import { describe, expect, it } from "vitest";

import { CommandNameConflictError } from "@/domain/command-name";
import { collectValidation, ValidationError } from "@/domain/domain-error";

function thrown(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }

  throw new Error("expected a throw");
}

describe("collectValidation", () => {
  it("rethrows a single failure as the original error object, subclass and stack included", () => {
    const original = new CommandNameConflictError("command", "help", "reserved");
    const error = thrown(() =>
      collectValidation(
        {
          command: () => {
            throw original;
          },
          title: () => "fine",
        },
        () => "unreachable",
      ),
    );

    expect(error).toBe(original);
    expect(error).toBeInstanceOf(CommandNameConflictError);
  });

  it("builds one aggregate only when several checks fail", () => {
    const error = thrown(() =>
      collectValidation(
        {
          command: () => {
            throw new CommandNameConflictError("command", "help", "reserved");
          },
          title: () => {
            throw new ValidationError("title", "title is required");
          },
        },
        () => "unreachable",
      ),
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).not.toBeInstanceOf(CommandNameConflictError);
    expect((error as ValidationError).issues.map((issue) => issue.field)).toEqual(["command", "title"]);
  });

  it("assembles the checked values only when every check passes, and lets other errors through", () => {
    expect(collectValidation({ one: () => 1, two: () => "2" }, ({ one, two }) => `${one}+${two}`)).toBe("1+2");
    expect(() =>
      collectValidation(
        {
          boom: () => {
            throw new TypeError("boom");
          },
        },
        () => "unreachable",
      ),
    ).toThrow(TypeError);
  });

  it("keeps the order of the checks and flattens nested aggregates", () => {
    const error = thrown(() =>
      collectValidation(
        {
          nested: () => {
            throw ValidationError.fromIssues([
              { field: "title", message: "a" },
              { field: "slug", message: "b" },
            ]);
          },
          link: () => {
            throw new ValidationError("linkLabel", "c");
          },
        },
        () => "unreachable",
      ),
    );

    expect((error as ValidationError).issues).toEqual([
      { field: "title", message: "a" },
      { field: "slug", message: "b" },
      { field: "linkLabel", message: "c" },
    ]);
    expect(error).toMatchObject({ field: "title", message: "a" });
  });
});
