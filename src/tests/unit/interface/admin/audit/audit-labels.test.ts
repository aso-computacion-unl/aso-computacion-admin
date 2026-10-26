import { describe, expect, it } from "vitest";

import { actorLabel, auditQuery, entityTypeLabel, parseAuditParams } from "@/interface/admin/audit/audit-labels";

describe("entityTypeLabel", () => {
  it("names the known entity types in Spanish and shows an unknown one as it is", () => {
    expect(entityTypeLabel("event")).toBe("Evento");
    expect(entityTypeLabel("session")).toBe("Sesión");
    expect(entityTypeLabel("settings")).toBe("Sitio");
    expect(entityTypeLabel("whatever")).toBe("whatever");
  });
});

describe("actorLabel", () => {
  const names = new Map([["ana", "Ana"]]);

  it("names a user, the emergency actor and the system", () => {
    expect(actorLabel({ actorKind: "user", actorUserId: "ana" }, names)).toBe("Ana");
    expect(actorLabel({ actorKind: "break_glass", actorUserId: null }, names)).toBe("Acceso de emergencia");
    expect(actorLabel({ actorKind: "system", actorUserId: null }, names)).toBe("Sistema");
  });

  it("does not leak an id for a user that no longer resolves", () => {
    expect(actorLabel({ actorKind: "user", actorUserId: "gone" }, names)).toBe("Usuario eliminado");
  });
});

describe("parseAuditParams", () => {
  it("reads the page, the entity type and the actor from the query string", () => {
    expect(parseAuditParams({ pagina: "3", tipo: "event", actor: "ana" })).toEqual({ page: 3, entityType: "event", actor: "ana" });
  });

  it.each([undefined, "", "0", "-2", "abc", "1.5", "9999999"])("treats the page %j as the first", (pagina) => {
    expect(parseAuditParams({ pagina }).page).toBe(1);
  });

  it("takes the first of a repeated parameter", () => {
    expect(parseAuditParams({ pagina: ["2", "3"] }).page).toBe(2);
  });

  it("drops empty filters and takes the first of a repeated one", () => {
    expect(parseAuditParams({ tipo: "", actor: ["ana", "ben"] })).toEqual({ page: 1, entityType: undefined, actor: "ana" });
  });

  it("caps the filter length so a long query cannot reach the database", () => {
    expect(parseAuditParams({ tipo: "x".repeat(200) }).entityType).toBeUndefined();
  });
});

describe("auditQuery", () => {
  it("builds the link of a page keeping the filters, without the first page's number", () => {
    expect(auditQuery({ entityType: "event", actor: "ana" }, 1)).toBe("/admin/registro?tipo=event&actor=ana");
    expect(auditQuery({ entityType: "event" }, 3)).toBe("/admin/registro?tipo=event&pagina=3");
    expect(auditQuery({}, 2)).toBe("/admin/registro?pagina=2");
    expect(auditQuery({}, 1)).toBe("/admin/registro");
  });
});
