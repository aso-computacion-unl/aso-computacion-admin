// @vitest-environment jsdom
import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { listMock } = vi.hoisted(() => ({ listMock: vi.fn() }));

vi.mock("@/interface/admin/board/board-members-admin-read", () => ({ getAdminBoardMembers: listMock }));
vi.mock("@/interface/admin/board/actions", () => ({ trashBoardMember: vi.fn(), moveBoardMember: vi.fn(), setBoardMemberPublished: vi.fn() }));
vi.mock("@/interface/admin/trash/actions", () => ({ restoreTrashed: vi.fn() }));
vi.mock("@/interface/admin/bulk/actions", () => ({ bulkSetPublished: vi.fn(), bulkTrash: vi.fn() }));
vi.mock("@/interface/admin/reorder/actions", () => ({ reorderContent: vi.fn() }));

import AdminBoardPage from "../../../../app/admin/board/page";
import { OrderedRow } from "../../../../app/admin/_components/ordered-row";
import { mount, unmountAll } from "@/tests/support/dom";

const member = (index: number, withPhoto: boolean) => ({
  id: `member-${index}`,
  name: `Integrante ${index}`,
  role: "Vocal",
  isPublished: true,
  photo: withPhoto ? { url: `https://res.cloudinary.com/demo/image/upload/people-${index}.jpg`, publicId: `people-${index}`, width: 400, height: 400, alt: "" } : null,
});

beforeEach(() => {
  listMock.mockReset();
});

describe("the board page", () => {
  it("lists every member, not only the first few, with the count the head announces", async () => {
    listMock.mockResolvedValue(Array.from({ length: 7 }, (_, index) => member(index, true)));

    const html = renderToStaticMarkup(await AdminBoardPage());

    expect(html).toContain("7 publicados");
    for (let index = 0; index < 7; index += 1) expect(html).toContain(`Integrante ${index}`);
  });

  it("opens with the Contenido tabs, Directiva lit, and one '+ Crear' where the head used to have its own button", async () => {
    listMock.mockResolvedValue([member(0, true)]);

    const html = renderToStaticMarkup(await AdminBoardPage());

    expect(html).toContain('aria-label="Tipo de contenido"');
    expect(html).toMatch(/<a[^>]*href="\/admin\/board"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="\/admin\/board"/);
    expect(html.match(/Crear<\/a>/g)).toHaveLength(1);
  });
});

/** What the browser holds for an element the server streamed in a later chunk: a lazy wrapper with no key. */
const streamed = (element: ReactElement) => ({ $$typeof: Symbol.for("react.lazy"), _payload: { value: element }, _init: (payload: { value: ReactElement }) => payload.value }) as unknown as ReactNode;

describe("a board row streamed from the server", () => {
  afterEach(async () => {
    await unmountAll();
    vi.restoreAllMocks();
  });

  it("does not make React report its lazy slots as unkeyed list children", async () => {
    const report = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await mount(
      createElement(
        OrderedRow,
        {
          id: "member-0",
          published: true,
          position: 1,
          label: "Integrante 0",
          editHref: "/admin/board/member-0/edit",
          media: streamed(createElement("img", { alt: "" })),
          toggle: streamed(createElement("button", { type: "button" }, "Publicado")),
          remove: streamed(createElement("button", { type: "button" }, "Mover a la papelera")),
        },
        createElement("h2", null, "Integrante 0"),
      ),
    );

    expect(report.mock.calls.filter(([message]) => String(message).includes('unique "key"'))).toEqual([]);
  });
});
