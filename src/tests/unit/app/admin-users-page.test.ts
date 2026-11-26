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
  it("with no users: an empty state in the users group explains that invited people appear here", async () => {
    const html = await render([]);
    const group = html.match(/<section aria-labelledby="users-title"[\s\S]*?<\/section>/)?.[0] ?? "";

    expect(group).toMatch(/<h2[^>]*>Usuarios con acceso<\/h2><span[^>]*>0<\/span>/);
    expect(group).toContain('data-slot="empty-state"');
    expect(group).toContain("Todavía nadie tiene acceso con Google.");
    expect(group).toContain("aparecen aquí");
  });

  it("keeps inviting in its own side panel, with the one submit", async () => {
    const html = await render([user("me", "Ana Admin")]);
    const panel = html.match(/<aside aria-labelledby="invite-title"[\s\S]*?<\/aside>/)?.[0] ?? "";

    expect(panel).toMatch(/<h2[^>]*>Invitar a una persona<\/h2>/);
    expect(panel.match(/type="submit"/g)).toHaveLength(1);
    expect(panel).toContain("Crear invitación");
  });

  it("titles the pending invitations with their total", async () => {
    const html = await render([user("me", "Ana Admin")], [{ id: "i1", email: "kevin@unl.edu.ec", role: "EDITOR", expiresAt: new Date("2099-01-01T00:00:00Z") }]);

    expect(html).toMatch(/<h2[^>]*>Invitaciones pendientes<\/h2><span[^>]*>1<\/span>/);
    expect(html).toContain("kevin@unl.edu.ec");
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
