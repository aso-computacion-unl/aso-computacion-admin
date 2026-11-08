import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { read } = vi.hoisted(() => ({ read: vi.fn() }));

vi.mock("@/interface/admin/audit/audit-admin-read", () => ({ getAuditLogPage: read }));

import AdminAuditPage from "../../../../app/admin/registro/page";

const entry = (overrides: Record<string, unknown>) => ({
  id: "log-1",
  at: new Date(),
  actorKind: "break_glass",
  actorUserId: null,
  action: "event.update",
  entityType: "event",
  entityId: "9f3c2a71-5b8e-4d0a-9c11-2e7d4a6b8f10",
  summary: "Cambió un evento",
  ...overrides,
});

const render = async (items: unknown[]) => {
  read.mockResolvedValue({ items, total: items.length, page: 1, pageCount: 1, entityTypes: ["event", "preview"], filters: {}, users: [] });

  return renderToStaticMarkup(await AdminAuditPage({ searchParams: Promise.resolve({}) }));
};

describe("the audit log page", () => {
  it("opens with the Ajustes tabs, Historial lit and the admin-only tabs locked", async () => {
    const html = await render([]);

    expect(html).toContain('aria-label="Ajustes"');
    expect(html).toMatch(/<a[^>]*href="\/admin\/registro"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="\/admin\/registro"/);
    expect(html).toContain('href="/admin/usuarios"');
    expect(html).toContain("solo administradores");
  });
});

describe("the audit log rows", () => {
  it("shows a short id after the entity type for a record that has one", async () => {
    const html = await render([entry({})]);

    expect(html).toContain("Evento · event.update");
    expect(html).toContain("#9f3c2a71");
  });

  it("names a preview code row 'Vista previa' and shows no id: its entity id is the lifetime, not a record", async () => {
    const html = await render([entry({ action: "preview.token_create", entityType: "preview", entityId: "24h", summary: "Código de vista previa generado (24 horas)" })]);

    expect(html).toContain("Vista previa · preview.token_create");
    expect(html).not.toContain("#24h");
    expect(html).not.toContain("preview ·");
  });
});
