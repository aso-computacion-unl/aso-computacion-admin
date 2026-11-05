import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { proxy } from "../../../../proxy";
import { TEST_SECRET, buildRequest } from "../middleware/support";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

import AdminCatchAll from "../../../../app/admin/[...rest]/page";
import AdminNotFound from "../../../../app/admin/not-found";
import ForumCatchAll from "../../../../app/foro/[...rest]/page";
import ForumNotFound from "../../../../app/foro/not-found";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// An address with no page is a 404 inside the segment's own layout only when a page of that segment throws
// notFound(): with no match at all Next renders app/not-found.tsx, outside the shell (F27).
describe.each([
  ["admin", AdminCatchAll, AdminNotFound],
  ["forum", ForumCatchAll, ForumNotFound],
])("the %s catch-all route", (_segment, CatchAll, SegmentNotFound) => {
  it("answers an unknown address with notFound(), so the segment's not-found renders inside its layout", () => {
    expect(() => CatchAll()).toThrow("NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("renders nothing of its own", () => {
    expect(() => renderToStaticMarkup(createElement(CatchAll))).toThrow("NOT_FOUND");
  });

  it("has a segment not-found page with a way back inside the product", () => {
    expect(renderToStaticMarkup(createElement(SegmentNotFound))).toContain('data-slot="not-found-state"');
  });
});

// The catch-all is a page like any other under /admin: the proxy decides before it renders, so an unknown address
// must not tell a visitor without a session anything, not even that the admin shell exists.
describe("an unknown admin address without a session", () => {
  it.each(["/admin/nope", "/admin/nope/deeper", "/admin/events/nope/extra", "/admin/%6Eope"])("%s goes to the login", async (path) => {
    vi.stubEnv("ADMIN_SECRET", TEST_SECRET);

    const response = await proxy(buildRequest(path));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });
});
