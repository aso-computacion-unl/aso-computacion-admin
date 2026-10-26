import { describe, expect, it } from "vitest";

import { RestoreConflictError } from "@/application";
import { mapActionError } from "@/interface/admin/action-result";

describe("mapActionError for restore conflicts (S4)", () => {
  it.each([
    ["slug", "charla", "event", /identificador «charla».*otro evento/],
    ["slug", "aviso", "news", /identificador «aviso».*otra noticia/],
    ["command", "costo", "faq", /«costo».*pregunta frecuente/],
    ["command", "horario", "command", /«horario».*otro comando/],
  ] as const)("names the %s «%s» used by a live %s, and says what to do", (field, value, owner, message) => {
    const result = mapActionError(new RestoreConflictError(field, value, owner));

    expect(result.error).toMatch(/^No se puede restaurar:/);
    expect(result.error).toMatch(message);
    expect(result.error).toMatch(/Cambie o elimine/);
    expect(result.fieldErrors).toBeUndefined();
  });
});
