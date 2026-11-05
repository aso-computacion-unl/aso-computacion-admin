import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({ cookiesMock: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import AdminForumCategoriesPage, { dynamic } from "../../../../app/admin/foro/categorias/page";
import EditForumCategoryPage from "../../../../app/admin/foro/categorias/[id]/edit/page";
import NewForumCategoryPage from "../../../../app/admin/foro/categorias/new/page";
import { cookieJar } from "@/tests/support/action-policy";
import { makeForumCategory, makeForumThread } from "@/tests/fakes/in-memory-forum";
import { signInAs } from "@/tests/support/test-auth";
import { testForum } from "@/tests/support/test-forum";

const renderList = async () => renderToStaticMarkup(await AdminForumCategoriesPage());
const renderEdit = async (id: string) => renderToStaticMarkup(await EditForumCategoryPage({ params: Promise.resolve({ id }) }));
const renderNew = async () => renderToStaticMarkup(await NewForumCategoryPage());

function seed() {
  testForum.store.categories.set("c1", makeForumCategory({ id: "c1", slug: "programacion", name: "Programación", description: "Código y errores", sortOrder: 1 }));
  testForum.store.categories.set("c2", makeForumCategory({ id: "c2", slug: "materias", name: "Materias", description: null, sortOrder: 2 }));
  testForum.store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1" }));
  testForum.store.threads.set("t2", makeForumThread({ id: "t2", categoryId: "c1" }));
}

beforeEach(async () => {
  vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
  cookieJar(cookiesMock, await signInAs("ADMIN"));
});

describe("the forum categories list page", () => {
  it("is never cached", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("with no category: an empty state that says why it matters and offers to create the first one", async () => {
    const html = await renderList();

    expect(html).toContain("Categorías del foro");
    expect(html).toContain("0 categorías");
    expect(html).toContain('data-slot="empty-state"');
    expect(html).toContain("Todavía no hay categorías");
    expect(html).toContain("no pueden abrir hilos");
    expect(html).toContain('href="/admin/foro/categorias/new"');
    expect(html).toContain("Crear la primera categoría");
    expect(html).not.toContain('data-slot="list-row"');
  });

  it("lists the categories in forum order with their slug, description, thread count and an edit link each", async () => {
    seed();

    const html = await renderList();

    expect(html).toContain("2 categorías");
    expect(html).not.toContain('data-slot="empty-state"');
    expect(html.indexOf("Programación")).toBeLessThan(html.indexOf("Materias"));
    expect(html).toContain("/foro?categoria=programacion");
    expect(html).toContain("Código y errores");
    expect(html).toContain("2 hilos");
    expect(html).toContain("0 hilos");
    expect(html).toContain('href="/admin/foro/categorias/c1/edit"');
    expect(html).toContain('href="/admin/foro/categorias/c2/edit"');
    expect(html).toContain("Eliminar: Programación");
    expect(html).toContain('href="/admin/foro/categorias/new"');
    expect(html).toContain("Agregar categoría");
  });

  it("sends an editor to the restricted notice and a visitor to the login", async () => {
    cookieJar(cookiesMock, await signInAs("EDITOR"));
    await expect(renderList()).rejects.toThrow("REDIRECT /admin?acceso=restringido");

    cookieJar(cookiesMock, undefined);
    await expect(renderList()).rejects.toThrow("REDIRECT /login");
  });
});

describe("the new forum category page", () => {
  it("shows an admin the form, framed like the other create pages", async () => {
    const html = await renderNew();

    expect(html).toContain("Nueva categoría");
    expect(html).toContain("Volver a categorías");
    expect(html).toContain('href="/admin/foro/categorias"');
    expect(html).toContain("sin guardar");
    expect(html).toContain('name="name"');
    expect(html).toContain('name="description"');
    expect(html).toContain('name="slug"');
    expect(html).toContain("Crear categoría");
    expect(html).toContain('data-slot="action-bar"');
  });

  it("does not show an editor the form: it sends them away before rendering it", async () => {
    cookieJar(cookiesMock, await signInAs("EDITOR"));

    await expect(renderNew()).rejects.toThrow("REDIRECT /admin?acceso=restringido");
  });

  it("sends a visitor to the login", async () => {
    cookieJar(cookiesMock, undefined);

    await expect(renderNew()).rejects.toThrow("REDIRECT /login");
  });
});

describe("the edit forum category page", () => {
  it("fills the form with the category and says how many threads it holds", async () => {
    seed();

    const html = await renderEdit("c1");

    expect(html).toMatch(/<h1[^>]*>Programación<\/h1>/);
    expect(html).toContain('value="Programación"');
    expect(html).toContain('value="programacion"');
    expect(html).toContain("Código y errores");
    expect(html).toContain("2 hilos");
    expect(html).toContain("Guardar cambios");
  });

  it("is the admin's not-found page for an id that does not exist", async () => {
    await expect(renderEdit("ghost")).rejects.toThrow("NOT_FOUND");
  });

  it("sends an editor away, even for an id that does exist", async () => {
    seed();
    cookieJar(cookiesMock, await signInAs("EDITOR"));

    await expect(renderEdit("c1")).rejects.toThrow("REDIRECT /admin?acceso=restringido");
  });
});
