import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { scanMock } = vi.hoisted(() => ({ scanMock: vi.fn() }));

vi.mock("@/interface/admin/media/media-cleanup-admin-read", () => ({ getAdminOrphanScan: scanMock }));
vi.mock("@/interface/admin/media/actions", () => ({ deleteOrphanImages: vi.fn() }));

import AdminImageCleanupPage from "../../../../app/admin/papelera/imagenes/page";

const render = async (despues?: string) => renderToStaticMarkup(await AdminImageCleanupPage({ searchParams: Promise.resolve({ despues }) }));

beforeEach(() => {
  scanMock.mockReset();
});

describe("the image cleanup under the trash", () => {
  it("goes back to the trash and pages within its own route", async () => {
    scanMock.mockResolvedValue({ status: "ok", scanned: 100, notManaged: 0, orphans: [], nextCursor: "abc def" });

    const html = await render("zzz");

    expect(html).toContain('href="/admin/papelera"');
    expect(html).toContain('href="/admin/papelera/imagenes"');
    expect(html).toContain('href="/admin/papelera/imagenes?despues=abc%20def"');
    expect(html).not.toContain("/admin/medios");
  });

  it("keeps saying that the review deletes nothing", async () => {
    scanMock.mockResolvedValue({ status: "ok", scanned: 3, notManaged: 0, orphans: [], nextCursor: null });

    const html = await render();

    expect(html).toContain("Esta revisión no borra nada");
    expect(html).toContain("24 horas");
    expect(html).toContain("Se revisó todo el almacén.");
  });
});
