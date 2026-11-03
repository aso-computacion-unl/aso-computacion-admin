import { describe, expect, it } from "vitest";

import { BREAK_GLASS_NOTICE, ROLE_LABELS, sessionLabel } from "@/interface/admin/role-labels";

describe("role labels", () => {
  it("names both roles in Spanish", () => {
    expect(ROLE_LABELS).toEqual({ ADMIN: "Administrador", EDITOR: "Editor" });
  });

  it("labels a user's session with the name and role, and an emergency session as such", () => {
    expect(sessionLabel({ kind: "user", name: "Ana", role: "EDITOR" })).toBe("Ana · Editor");
    expect(sessionLabel({ kind: "break_glass", name: "Acceso de emergencia", role: "ADMIN" })).toBe("Acceso de emergencia");
  });

  it("warns that the emergency login is not for everyday use", () => {
    expect(BREAK_GLASS_NOTICE).toMatch(/emergencia/);
    expect(BREAK_GLASS_NOTICE).toMatch(/cierre la sesión/);
  });
});
