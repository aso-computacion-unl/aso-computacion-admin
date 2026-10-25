import { describe, expect, it } from "vitest";

import { CommandNameConflictError, ValidationError } from "@/domain";
import {
  TERMINAL_COMMAND_DESCRIPTION_MAX_LENGTH,
  TERMINAL_COMMAND_OUTPUT_MAX_LENGTH,
  TerminalCommand,
} from "@/domain/terminal-command";

function build(overrides: Partial<Parameters<typeof TerminalCommand.create>[0]> = {}): TerminalCommand {
  return TerminalCommand.create({
    command: "horario",
    description: "Cuándo nos reunimos",
    output: "Martes y jueves, 18:00.",
    sortOrder: 0,
    ...overrides,
  });
}

describe("TerminalCommand.create", () => {
  it("trims the text and starts unpublished", () => {
    const command = build({ command: " horario ", description: "  Cuándo  ", output: "  Martes.  " });

    expect(command.props).toMatchObject({ command: "horario", description: "Cuándo", output: "Martes.", sortOrder: 0, isPublished: false });
    expect(command.props.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps a multi-line output as written", () => {
    expect(build({ output: "Línea 1\nLínea 2\n\nLínea 4" }).props.output).toBe("Línea 1\nLínea 2\n\nLínea 4");
  });

  it("states the limits: 80 for the description, 600 for the output", () => {
    expect(TERMINAL_COMMAND_DESCRIPTION_MAX_LENGTH).toBe(80);
    expect(TERMINAL_COMMAND_OUTPUT_MAX_LENGTH).toBe(600);
  });

  it("accepts the length limits exactly", () => {
    expect(() => build({ command: "a".repeat(28), description: "d".repeat(80), output: "o".repeat(600) })).not.toThrow();
    expect(() => build({ command: "ab" })).not.toThrow();
  });

  it.each([
    ["command", { command: "" }],
    ["command", { command: "a" }],
    ["command", { command: "a".repeat(29) }],
    ["command", { command: "Horario" }],
    ["command", { command: "mi comando" }],
    ["description", { description: "   " }],
    ["description", { description: "d".repeat(81) }],
    ["output", { output: "" }],
    ["output", { output: "o".repeat(601) }],
    ["sortOrder", { sortOrder: -1 }],
  ])("rejects an invalid %s", (field, overrides) => {
    expect(() => build(overrides)).toThrow(ValidationError);
    expect(() => build(overrides)).toThrow(expect.objectContaining({ field }));
  });

  it.each(["help", "ayuda", "ls", "clear", "git"])("rejects the reserved word %s", (command) => {
    expect(() => build({ command })).toThrow(CommandNameConflictError);
  });
});

describe("TerminalCommand.update / withPublished / withSortOrder", () => {
  it("re-validates updated fields and keeps the rest", () => {
    const command = build();
    const updated = command.update({ output: "Lunes." });

    expect(updated.props).toMatchObject({ id: command.props.id, command: "horario", output: "Lunes." });
    expect(() => command.update({ command: "Mal Nombre" })).toThrow(ValidationError);
    expect(() => command.update({ command: "help" })).toThrow(CommandNameConflictError);
    expect(() => command.update({ description: "d".repeat(81) })).toThrow(ValidationError);
  });

  it("toggles publication and sets the order without touching the text", () => {
    const command = build();

    expect(command.withPublished(true).props.isPublished).toBe(true);
    expect(command.withSortOrder(3).props.sortOrder).toBe(3);
    expect(() => command.withSortOrder(-2)).toThrow(ValidationError);
  });
});
