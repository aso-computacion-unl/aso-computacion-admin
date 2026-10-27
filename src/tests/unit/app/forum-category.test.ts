import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, redirectMock, notFoundMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  redirectMock: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({ redirect: redirectMock, notFound: notFoundMock }));

import CategoryPage from "../../../../app/foro/c/[slug]/page";
import { makeForumCategory } from "@/tests/fakes/in-memory-forum";
import { cookieJar, forumMemberJar, stubForumSecrets } from "@/tests/support/forum-page";
import { testForum } from "@/tests/support/test-forum";

type Query = { estado?: string | string[]; pagina?: string | string[] };

const visit = (slug: string, query: Query = {}) => CategoryPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(query) });

beforeEach(async () => {
  vi.clearAllMocks();
  stubForumSecrets();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  testForum.store.categories.set("c1", makeForumCategory({ id: "c1", slug: "programacion", name: "Programación", description: "Código y dudas" }));
  cookiesMock.mockResolvedValue((await forumMemberJar()).jar);
});

describe("a category page", () => {
  it("is for members: a visitor goes to the sign-in at /foro, carrying this path", async () => {
    cookiesMock.mockResolvedValue(cookieJar({}));

    await expect(visit("programacion")).rejects.toThrow(`REDIRECT /foro?next=${encodeURIComponent("/foro/c/programacion")}`);
  });

  it("is a 404 for a category that does not exist", async () => {
    await expect(visit("no-existe")).rejects.toThrow("NOT_FOUND");
  });

  it("redirects to the forum list with that category active, so old links keep working", async () => {
    await expect(visit("programacion")).rejects.toThrow("REDIRECT /foro?categoria=programacion");
  });

  it("keeps the solved tab and the page in the redirect", async () => {
    await expect(visit("programacion", { estado: "resueltos", pagina: "2" })).rejects.toThrow("REDIRECT /foro?categoria=programacion&estado=resueltos&pagina=2");
  });

  it("drops an unknown tab and a bad page instead of carrying them over", async () => {
    await expect(visit("programacion", { estado: "todo", pagina: "-3" })).rejects.toThrow(/^REDIRECT \/foro\?categoria=programacion$/);
  });
});
