import { describe, expect, it } from "vitest";

import { COMMAND_NAME_MAX_LENGTH, RESERVED_COMMAND_NAMES, assertCommandName, optionalCommandName } from "@/domain/command-name";
import { CommandNameConflictError, ValidationError } from "@/domain";

describe("assertCommandName format (S2)", () => {
  it.each(["ab", "whoami", "horario", "inscripciones", "como-me-entero", "a1", "a-1-b", "a".repeat(28)])(
    "accepts %s",
    (name) => {
      expect(assertCommandName("command", name)).toBe(name);
    },
  );

  it("accepts the length bounds exactly: 2 and 28 characters", () => {
    expect(COMMAND_NAME_MAX_LENGTH).toBe(28);
    expect(() => assertCommandName("command", "ab")).not.toThrow();
    expect(() => assertCommandName("command", "a".repeat(28))).not.toThrow();
    expect(() => assertCommandName("command", "a")).toThrow(ValidationError);
    expect(() => assertCommandName("command", "a".repeat(29))).toThrow(ValidationError);
  });

  it.each([
    ["empty", ""],
    ["one character", "a"],
    ["29 characters", "a".repeat(29)],
    ["uppercase", "Horario"],
    ["starts with a digit", "1ab"],
    ["starts with a hyphen", "-ab"],
    ["ends with a hyphen", "ab-"],
    ["double hyphen", "a--b"],
    ["space", "a b"],
    ["underscore", "a_b"],
    ["accent", "inscripción"],
    ["slash", "a/b"],
  ])("rejects %s with a ValidationError on the given field", (_label, name) => {
    expect(() => assertCommandName("command", name)).toThrow(ValidationError);
    expect(() => assertCommandName("command", name)).toThrow(expect.objectContaining({ field: "command" }));
  });

  it("trims surrounding whitespace before checking", () => {
    expect(assertCommandName("command", "  whoami \n")).toBe("whoami");
  });
});

describe("assertCommandName reserved words (S3)", () => {
  it("reserves exactly the shell words", () => {
    expect([...RESERVED_COMMAND_NAMES].sort()).toEqual(["ayuda", "clear", "git", "help", "ls"]);
  });

  it.each(["help", "ayuda", "ls", "clear", "git"])("rejects %s as a reserved word", (name) => {
    expect(() => assertCommandName("command", name)).toThrow(CommandNameConflictError);
    expect(() => assertCommandName("command", name)).toThrow(
      expect.objectContaining({ field: "command", command: name, conflict: "reserved" }),
    );
  });

  it("does not reserve names that merely contain a reserved word", () => {
    expect(() => assertCommandName("command", "git-help")).not.toThrow();
    expect(() => assertCommandName("command", "lsx")).not.toThrow();
  });
});

describe("optionalCommandName", () => {
  it.each([null, undefined, "", "   "])("turns %j into null", (value) => {
    expect(optionalCommandName("command", value)).toBeNull();
  });

  it("validates a present value like assertCommandName", () => {
    expect(optionalCommandName("command", " horario ")).toBe("horario");
    expect(() => optionalCommandName("command", "Mal Comando")).toThrow(ValidationError);
    expect(() => optionalCommandName("command", "help")).toThrow(CommandNameConflictError);
  });
});
