import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({ redirectMock: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import AdminMediaPage from "../../../../app/admin/medios/page";
import AdminMediaCleanupRedirect from "../../../../app/admin/medios/limpieza/page";
import AdminPreviewPage from "../../../../app/admin/vista-previa/page";

beforeEach(() => {
  vi.clearAllMocks();
});

// Medios and Vista previa left the admin; their old URLs may still be bookmarked, so they send people on instead of a 404.
describe("the retired admin URLs", () => {
  it("sends /admin/medios to the trash, where the image cleanup now lives", () => {
    AdminMediaPage();

    expect(redirectMock).toHaveBeenCalledExactlyOnceWith("/admin/papelera");
  });

  it("sends /admin/medios/limpieza to the cleanup under the trash", () => {
    AdminMediaCleanupRedirect();

    expect(redirectMock).toHaveBeenCalledExactlyOnceWith("/admin/papelera/imagenes");
  });

  it("sends /admin/vista-previa to the home", () => {
    AdminPreviewPage();

    expect(redirectMock).toHaveBeenCalledExactlyOnceWith("/admin");
  });
});
