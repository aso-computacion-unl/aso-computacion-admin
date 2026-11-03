import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// The error boundary reports from an effect, which a server render never runs: run it on the spot.
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<typeof import("react")>()), useEffect: (effect: () => void) => effect() }));

import ForumError from "../../../../app/foro/error";
import ForumNotFound from "../../../../app/foro/not-found";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the forum error boundary", () => {
  const render = (error: Error & { digest?: string }, reset = vi.fn()) => renderToStaticMarkup(createElement(ForumError, { error, reset }));

  it("announces itself as an alert, offers a retry and a way back, and shows the digest as a reference", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const html = render(Object.assign(new Error("secret database detail"), { digest: "abc123" }));

    expect(html).toContain('role="alert"');
    expect(html).toContain("Reintentar");
    expect(html).toContain('href="/foro"');
    expect(html).toContain("abc123");
    expect(html).not.toContain("secret database detail");
    expect(log).toHaveBeenCalledWith("Forum route error", "abc123");
  });

  it("sets its title in the forum's Mona Sans title style, not the brand display face (S9)", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const title = render(new Error("boom")).match(/<h1[^>]*>/)?.[0] ?? "";

    expect(title).not.toContain("font-display");
    expect(title).toContain("font-bold");
    expect(title).toContain("font-stretch-[106%]");
  });

  it("shows no reference when the error has no digest", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(render(new Error("boom"))).not.toContain("Código");
  });
});

describe("the forum not-found page", () => {
  it("says the page is gone, without telling a missing thread from a hidden one, and links back to the forum", () => {
    const html = renderToStaticMarkup(createElement(ForumNotFound));

    expect(html).toContain("No encontrado");
    expect(html).toContain("ya no está disponible");
    expect(html).toContain('href="/foro"');
  });

  it("does not name a kind of page, because categories, threads and events all end here", () => {
    const html = renderToStaticMarkup(createElement(ForumNotFound));

    expect(html).not.toMatch(/categor[ií]a|hilo/i);
  });
});

const FORUM_DIRECTORY = join(__dirname, "../../../../app/foro");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) return sourceFiles(path);

    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

// The reply form refreshes the thread with `router.refresh()`. The admin found that, with Next 15.5 and React 19.2, a
// Suspense boundary around a page (a `loading.tsx` included) keeps that refresh suspended (see admin-route-boundaries).
// The forum would show a reply as published and not render it, so it keeps the same rule until Next/React are upgraded.
describe("forum route boundaries", () => {
  const files = sourceFiles(FORUM_DIRECTORY);

  it("has no loading.tsx", () => {
    expect(files.filter((file) => /(^|\/)loading\.tsx?$/.test(relative(FORUM_DIRECTORY, file)))).toEqual([]);
  });

  it("does not render a Suspense boundary", () => {
    expect(files.filter((file) => /<Suspense[\s>]/.test(readFileSync(file, "utf8")))).toEqual([]);
  });
});
