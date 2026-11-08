import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessionMock, redirectMock } = vi.hoisted(() => ({ sessionMock: vi.fn(), redirectMock: vi.fn() }));

vi.mock("@/interface/auth/require-page-session", () => ({ requirePageSession: sessionMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import AdminAjustesPage from "../../../../app/admin/ajustes/page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the ajustes entry route", () => {
  it("sends an administrator to the first tab, the team", async () => {
    sessionMock.mockResolvedValue({ userId: "me", role: "ADMIN" });
    await AdminAjustesPage();

    expect(sessionMock).toHaveBeenCalledWith();
    expect(redirectMock).toHaveBeenCalledExactlyOnceWith("/admin/usuarios");
  });

  it("sends an editor to their sessions, the first tab they can open, instead of back to the home", async () => {
    sessionMock.mockResolvedValue({ userId: "me", role: "EDITOR" });
    await AdminAjustesPage();

    expect(redirectMock).toHaveBeenCalledExactlyOnceWith("/admin/sesiones");
  });

  it("asks for a session first: an expired one never reaches the redirect", async () => {
    sessionMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(AdminAjustesPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
