import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, notFoundMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
  notFound: notFoundMock,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import NewThreadPage from "../../../../app/foro/c/[slug]/nuevo/page";
import { makeForumCategory } from "@/tests/fakes/in-memory-forum";
import { cookieJar, forumMemberJar, stubForumSecrets } from "@/tests/support/forum-page";
import { testForum } from "@/tests/support/test-forum";

const render = (slug: string) => NewThreadPage({ params: Promise.resolve({ slug }) }).then((element) => renderToStaticMarkup(element));

/** The `memberId` props found anywhere in the element tree the page returned (before it renders): what the page hands the browser. */
function memberIdProps(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(memberIdProps);
  if (typeof node !== "object" || node === null || !("props" in node)) return [];

  const props = (node as { props: { memberId?: unknown; children?: unknown } }).props;

  return [...(typeof props.memberId === "string" ? [props.memberId] : []), ...memberIdProps(props.children)];
}

let viewerId = "";

beforeEach(async () => {
  vi.clearAllMocks();
  stubForumSecrets();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  testForum.store.categories.set("c1", makeForumCategory({ id: "c1", slug: "programacion", name: "Programación" }));
  const viewer = await forumMemberJar();
  viewerId = viewer.memberId;
  cookiesMock.mockResolvedValue(viewer.jar);
});

describe("the new-thread page", () => {
  it("hands the composer the id of the member writing, which owns the draft kept in the browser (D5)", async () => {
    expect(memberIdProps(await NewThreadPage({ params: Promise.resolve({ slug: "programacion" }) }))).toEqual([viewerId]);
  });

  it("is for members: a visitor goes to the sign-in at /foro", async () => {
    cookiesMock.mockResolvedValue(cookieJar({}));

    await expect(render("programacion")).rejects.toThrow("REDIRECT /foro");
  });

  it("is a 404 for a category that does not exist", async () => {
    await expect(render("no-existe")).rejects.toThrow("NOT_FOUND");
  });

  it("names the category it posts to and renders the composer with its way back", async () => {
    const html = await render("programacion");

    expect(html).toContain("<h1");
    expect(html).toContain("Nuevo hilo");
    expect(html).toContain("Se publica en <strong");
    expect(html).toContain("Programación");
    expect(html).toContain('name="title"');
    expect(html).toContain('name="body"');
    expect(html).toContain("Publicar hilo");
    expect(html).toContain('href="/foro?categoria=programacion"');
  });
});
