import { describe, expect, it, vi } from "vitest";

import { CommandNameConflictError, ValidationError } from "@/domain";
import { mapActionError } from "@/interface/admin/action-result";

describe("mapActionError for command names (S2, S3)", () => {
  it("explains the format on the command field", () => {
    const result = mapActionError(new ValidationError("command", "command must be 2-28 lowercase letters"));

    expect(result).toEqual({ fieldErrors: { command: expect.stringMatching(/2 a 28.*minúsculas.*letra/) } });
  });

  it.each([
    ["reserved", "help", /«help».*reservad/],
    ["faq", "costo", /«costo».*pregunta frecuente/],
    ["command", "horario", /«horario».*otro comando/],
  ] as const)("names the %s conflict in Spanish on the command field", (conflict, name, message) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(mapActionError(new CommandNameConflictError("command", name, conflict))).toEqual({
      fieldErrors: { command: expect.stringMatching(message) },
    });
  });
});
