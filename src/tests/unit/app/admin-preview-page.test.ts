import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setupMock, codesMock, pendingMock } = vi.hoisted(() => ({ setupMock: vi.fn(), codesMock: vi.fn(), pendingMock: vi.fn() }));

vi.mock("@/interface/admin/preview/preview-admin-read", () => ({ getPreviewSetup: setupMock, getPreviewCodes: codesMock, getPreviewPending: pendingMock }));
vi.mock("@/interface/admin/preview/actions", () => ({ createPreviewToken: vi.fn() }));

import AdminPreviewPage from "../../../../app/admin/vista-previa/page";

const NOW = Date.now();
const HOUR = 3_600_000;

const code = (id: string, by: string, startedHoursAgo: number, lifetimeHours: number | null) => ({
  id,
  by,
  createdAt: new Date(NOW - startedHoursAgo * HOUR),
  expiresAt: lifetimeHours === null ? null : new Date(NOW + (lifetimeHours - startedHoursAgo) * HOUR),
});

beforeEach(() => {
  setupMock.mockResolvedValue({ configured: true, endpoint: "https://admin.aso.test/api/public/preview" });
  codesMock.mockResolvedValue({ scope: "all", codes: [] });
  pendingMock.mockResolvedValue({ drafts: [], draftsTotal: 0 });
});

const render = async () => renderToStaticMarkup(await AdminPreviewPage());

describe("the preview page", () => {
  it("puts the form in the form column with the real data beside it, not in a full-width panel", async () => {
    const html = await render();

    expect(html).toContain('data-layout="split"');
    expect(html.indexOf('data-slot="form-column"')).toBeLessThan(html.indexOf("preview-title"));
    expect(html.indexOf("preview-title")).toBeLessThan(html.indexOf('data-slot="form-aside"'));
    expect(html.indexOf('data-slot="form-aside"')).toBeLessThan(html.indexOf("revealed-title"));
  });

  it("lists the drafts and scheduled items, each linking to its edit page", async () => {
    pendingMock.mockResolvedValue({
      drafts: [
        { id: "e1", kind: "Evento", title: "Taller de Git", href: "/admin/events/e1/edit", scheduled: true },
        { id: "n1", kind: "Noticia", title: "Nueva directiva", href: "/admin/news/n1/edit", scheduled: false },
      ],
      draftsTotal: 4,
    });

    const html = await render();

    expect(html).toContain('href="/admin/events/e1/edit"');
    expect(html).toContain('href="/admin/news/n1/edit"');
    expect(html).toContain("Taller de Git");
    expect(html).toContain("programado");
    expect(html).toContain("borrador");
    expect(html).toContain("2 elementos más");
  });

  it("says why there is nothing to reveal when there are no drafts", async () => {
    const html = await render();

    expect(html).toContain('data-slot="empty-state"');
    expect(html).toContain("hoy un código mostraría lo mismo que el sitio público");
  });

  it("shows who generated each code, when, and whether it is still valid, and says plainly that it cannot be revoked", async () => {
    codesMock.mockResolvedValue({ scope: "all", codes: [code("a", "Ana Mora", 1, 24), code("b", "Ben Cruz", 30, 24), code("c", "Cleo Ruiz", 2, null)] });

    const html = await render();

    expect(html).toContain("Ana Mora");
    expect(html).toContain("Vigente · vence");
    expect(html).toContain("Venció");
    expect(html).toContain("Vigencia no registrada");
    expect(html).toContain("Un código no se puede revocar desde aquí");
    expect(html).toContain("Los más recientes, de todas las personas.");
  });

  it("tells an Editor that they see only their own codes", async () => {
    codesMock.mockResolvedValue({ scope: "own", codes: [code("a", "Test EDITOR", 1, 1)] });

    const html = await render();

    expect(html).toContain("Los más recientes que usted generó.");
    expect(html).not.toContain("de todas las personas");
  });

  it("uses an empty state, by scope, when no code was generated", async () => {
    expect(await render()).toContain("Todavía nadie generó un código.");

    codesMock.mockResolvedValue({ scope: "own", codes: [] });

    expect(await render()).toContain("Usted todavía no generó ningún código.");
  });

  it("still shows the form's missing-configuration message and the history when the server has no secret", async () => {
    setupMock.mockResolvedValue({ configured: false, endpoint: null });
    codesMock.mockResolvedValue({ scope: "all", codes: [code("a", "Ana Mora", 1, 24)] });

    const html = await render();

    expect(html).toContain("PREVIEW_TOKEN_SECRET");
    expect(html).toContain("Ana Mora");
  });
});
