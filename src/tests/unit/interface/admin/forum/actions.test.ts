import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, revalidatePathMock } = vi.hoisted(() => ({ cookiesMock: vi.fn(), revalidatePathMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`);
  },
}));

import { FORBIDDEN_MESSAGE, SESSION_EXPIRED_MESSAGE } from "@/interface/admin/action-result";
import * as actions from "@/interface/admin/forum/actions";
import { getAdminForumCategories } from "@/interface/admin/forum/forum-admin-read";
import { FORUM_COOKIE_NAME } from "@/infrastructure/forum/forum-session-jwt";
import { cookieJar, registerPolicyCases } from "@/tests/support/action-policy";
import { makeForumCategory, makeForumThread } from "@/tests/fakes/in-memory-forum";
import { signInAs, testAuth } from "@/tests/support/test-auth";
import { signInToForumAs, testForum } from "@/tests/support/test-forum";

function categoryForm(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

// A fresh name every call: the policy suite runs the same action more than once, and a repeated slug is refused.
let created = 0;

const seed = () => testForum.store.categories.set("c1", makeForumCategory({ id: "c1", slug: "programacion", name: "Programación" }));

describe("forum category server actions", () => {
  describe("role matrix and audit", () => {
    registerPolicyCases({
      actionsPath: "src/interface/admin/forum/actions.ts",
      actionCalls: {
        createForumCategory: () => actions.createForumCategory(null, categoryForm({ name: `Eventos ${(created += 1)}` })),
        updateForumCategory: async () => (seed(), actions.updateForumCategory("c1", null, categoryForm({ name: "Código" }))),
        deleteForumCategory: async () => (seed(), actions.deleteForumCategory("c1")),
      },
      cookiesMock,
      untouchedMocks: [revalidatePathMock],
    });
  });

  describe("behaviour", () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
      vi.stubEnv("FORUM_SESSION_SECRET", "forum-secret-forum-secret-forum-secret-1234");
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      cookieJar(cookiesMock, await signInAs("ADMIN"));
    });

    it("creates a category with a derived slug and refreshes the admin page", async () => {
      expect(await actions.createForumCategory(null, categoryForm({ name: " Materias y cursos ", description: "Dudas de clase" }))).toEqual({ success: true });

      expect([...testForum.store.categories.values()]).toMatchObject([{ slug: "materias-y-cursos", name: "Materias y cursos", description: "Dudas de clase", sortOrder: 1 }]);
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/foro");
    });

    it("says in Spanish, on the field, what is wrong with a category", async () => {
      seed();

      expect(await actions.createForumCategory(null, categoryForm({ name: " " }))).toEqual({ fieldErrors: { name: "El nombre es obligatorio y admite hasta 60 caracteres." } });
      expect(await actions.createForumCategory(null, categoryForm({ name: "Ok", description: "x".repeat(201) }))).toEqual({ fieldErrors: { description: "La descripción admite hasta 200 caracteres." } });
      expect(await actions.createForumCategory(null, categoryForm({ name: "Otra", slug: "programacion" }))).toMatchObject({ fieldErrors: { slug: expect.any(String) } });
      expect(await actions.createForumCategory(null, categoryForm({ name: "Ok", extra: "x" }))).toEqual({ fieldErrors: { form: "El formulario incluye campos no admitidos." } });
      expect(testAuth.audit.entries).toEqual([]);
    });

    it("updates a category, keeping the slug when the field is blank", async () => {
      seed();

      expect(await actions.updateForumCategory("c1", null, categoryForm({ name: "Código", slug: "" }))).toEqual({ success: true });
      expect(testForum.store.categories.get("c1")).toMatchObject({ name: "Código", slug: "programacion" });
      expect(await actions.updateForumCategory("ghost", null, categoryForm({ name: "X" }))).toEqual({ error: "No se encontró la categoría." });
    });

    it("refuses to delete a category that still has threads, and deletes an empty one", async () => {
      seed();
      testForum.store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1" }));

      expect(await actions.deleteForumCategory("c1")).toEqual({ error: "La categoría todavía tiene hilos y no se puede eliminar." });
      expect(testAuth.audit.entries).toEqual([]);

      testForum.store.threads.clear();

      expect(await actions.deleteForumCategory("c1")).toEqual({ success: true });
      expect(testForum.store.categories.size).toBe(0);
    });

    it("keeps post bodies and emails out of the audit entries", async () => {
      await actions.createForumCategory(null, categoryForm({ name: "Eventos" }));

      expect(JSON.stringify(testAuth.audit.entries)).not.toContain("@");
    });
  });

  describe("who may manage categories", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
      vi.stubEnv("FORUM_SESSION_SECRET", "forum-secret-forum-secret-forum-secret-1234");
      vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    it("refuses an editor, and nothing is written", async () => {
      cookieJar(cookiesMock, await signInAs("EDITOR"));

      expect(await actions.createForumCategory(null, categoryForm({ name: "Eventos" }))).toEqual({ error: FORBIDDEN_MESSAGE });
      expect(testForum.store.categories.size).toBe(0);
    });

    it("refuses a forum member, even one holding a valid forum session: the cookie is not an admin session", async () => {
      const { cookie } = await signInToForumAs();
      cookiesMock.mockResolvedValue({ get: (name: string) => (name === FORUM_COOKIE_NAME ? { name, value: cookie } : undefined) });

      expect(await actions.createForumCategory(null, categoryForm({ name: "Eventos" }))).toEqual({ error: SESSION_EXPIRED_MESSAGE });
      expect(await actions.deleteForumCategory("c1")).toEqual({ error: SESSION_EXPIRED_MESSAGE });
      expect(testForum.store.categories.size).toBe(0);
      await expect(getAdminForumCategories()).rejects.toThrow("REDIRECT /login");
    });

    it("lists the categories for an admin page, and sends an editor away", async () => {
      seed();
      cookieJar(cookiesMock, await signInAs("ADMIN"));
      expect((await getAdminForumCategories()).map((category) => category.slug)).toEqual(["programacion"]);

      cookieJar(cookiesMock, await signInAs("EDITOR"));
      await expect(getAdminForumCategories()).rejects.toThrow("REDIRECT /admin?acceso=restringido");
    });
  });
});
