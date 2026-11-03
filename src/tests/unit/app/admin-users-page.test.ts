import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessionMock, usersMock, invitesMock } = vi.hoisted(() => ({ sessionMock: vi.fn(), usersMock: vi.fn(), invitesMock: vi.fn() }));

vi.mock("@/interface/auth/require-page-session", () => ({ requirePageSession: sessionMock }));
vi.mock("@/interface/admin/users/users-admin-read", () => ({ getAdminUsers: usersMock, getPendingInvites: invitesMock }));
vi.mock("@/interface/admin/users/actions", () => ({ createAdminInvite: vi.fn(), revokeAdminInvite: vi.fn(), setUserActive: vi.fn(), changeUserRole: vi.fn() }));

import AdminUsersPage from "../../../../app/admin/usuarios/page";

const user = (id: string, name: string) => ({ id, name, email: `${id}@example.com`, role: "EDITOR" as const, active: true, lastLoginAt: null });

async function render(users: ReturnType<typeof user>[], invites: unknown[] = []) {
  sessionMock.mockResolvedValue({ userId: "me", role: "ADMIN" });
  usersMock.mockResolvedValue(users);
  invitesMock.mockResolvedValue(invites);

  return renderToStaticMarkup(await AdminUsersPage());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the usuarios page", () => {
  it("with no users: an empty state under the invite panel explains that invited people appear here", async () => {
    const html = await render([]);

    expect(html).toContain('data-slot="empty-state"');
    expect(html).toContain("Todavía nadie tiene acceso con Google.");
    expect(html).toContain("aparecen aquí");
    expect(html.indexOf("Invitar a una persona")).toBeLessThan(html.indexOf('data-slot="empty-state"'));
  });

  it("with only the signed-in administrator: the list shows them and the empty state says nobody else is in yet", async () => {
    const html = await render([user("me", "Ana Admin")]);

    expect(html).toContain("Ana Admin");
    expect(html).toContain('data-slot="empty-state"');
    expect(html).toContain("solo usted tiene acceso");
  });

  it("with other users: no empty state", async () => {
    const html = await render([user("me", "Ana Admin"), user("u2", "Luis Editor")]);

    expect(html).toContain("Luis Editor");
    expect(html).not.toContain('data-slot="empty-state"');
  });
});
