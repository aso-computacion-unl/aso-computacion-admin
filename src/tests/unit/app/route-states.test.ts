import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// The error boundary reports from an effect, which a server render never runs: run it on the spot.
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<typeof import("react")>()), useEffect: (effect: () => void) => effect() }));
vi.mock("../../../../app/_components/brand-mark", () => ({ BrandLogo: () => null }));

import AdminError from "../../../../app/admin/error";
import { PageSkeleton } from "../../../../app/admin/_components/page-skeleton";
import AdminNotFound from "../../../../app/admin/not-found";
import NotFound from "../../../../app/not-found";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("admin error boundary", () => {
  function render(error: Error & { digest?: string }, reset = vi.fn()) {
    return renderToStaticMarkup(createElement(AdminError, { error, reset }));
  }

  it("offers a retry in Spanish and announces itself as an alert", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const html = render(Object.assign(new Error("boom"), { digest: "abc123" }));

    expect(html).toContain('role="alert"');
    expect(html).toContain("Reintentar");
  });

  it("logs the digest and shows it as a reference, never the message or the stack", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(new Error("secret database detail"), { digest: "abc123" });

    const html = render(error);

    expect(log).toHaveBeenCalledWith("Admin route error", "abc123");
    expect(html).toContain("abc123");
    expect(html).not.toContain("secret database detail");
    expect(html).not.toContain("Error:");
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret database detail");
  });

  it("shows no reference when the error has no digest", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(render(new Error("boom"))).not.toContain("Código");
  });

  it("calls reset when Reintentar is pressed", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reset = vi.fn();

    const tree = AdminError({ error: new Error("boom"), reset });
    const button = findButton(tree);

    button.props.onClick?.();

    expect(reset).toHaveBeenCalledTimes(1);
  });
});

interface Element {
  type: unknown;
  props: { children?: unknown; onClick?: () => void };
}

/** The first element in the tree with an `onClick`: the page has a single button. */
function findButton(node: unknown): Element {
  const found = search(node);

  if (!found) throw new Error("no button in the tree");

  return found;
}

function search(node: unknown): Element | undefined {
  if (Array.isArray(node)) return node.map(search).find(Boolean);
  if (typeof node !== "object" || node === null || !("props" in node)) return undefined;

  const element = node as Element;

  return element.props.onClick ? element : search(element.props.children);
}

describe("page skeleton", () => {
  it("is a busy status that screen readers announce, with the skeleton hidden from them", () => {
    const html = renderToStaticMarkup(createElement(PageSkeleton));

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Cargando…");
    expect(html).toContain('aria-hidden="true"');
  });
});

describe("not-found pages", () => {
  it("sends the admin back to its home", () => {
    const html = renderToStaticMarkup(createElement(AdminNotFound));

    expect(html).toContain("No encontrado");
    expect(html).toContain('href="/admin"');
  });

  it("explains a missing URL outside the admin and links to the panel", () => {
    const html = renderToStaticMarkup(createElement(NotFound));

    expect(html).toContain("Página no encontrada");
    expect(html).toContain('href="/admin"');
  });
});
