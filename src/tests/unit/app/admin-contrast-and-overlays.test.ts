import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));

import { TabBar } from "../../../../app/admin/_components/admin-nav";
import { WindowBadge } from "../../../../app/admin/_components/window-badge";
import { ToastProvider } from "../../../../app/admin/_components/toast";

const read = (path: string) => readFileSync(path, "utf8");
const css = read("app/globals.css");
const lightStart = css.indexOf(':root[data-theme="light"] {');
const darkTokens = css.slice(0, lightStart);
const lightTokens = css.slice(lightStart, css.indexOf("}", lightStart));

/** The hex value of a colour token, from the light block when it overrides it and from `@theme` otherwise. */
const token = (name: string, theme: "dark" | "light"): string => {
  const pattern = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`);
  const match = (theme === "light" ? lightTokens.match(pattern) : null) ?? darkTokens.match(pattern);

  if (!match?.[1]) throw new Error(`token ${name} not found`);

  return match[1];
};

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;

    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];

  return (light + 0.05) / (dark + 0.05);
};

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);

    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".tsx") ? [path] : [];
  });

describe("red text (WCAG AA 4.5:1)", () => {
  it("the error tint reads on every dark surface and every light surface", () => {
    for (const surface of ["navy", "navy-deep", "navy-lift"]) {
      expect(contrast(token("error", "dark"), token(surface, "dark"))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token("error", "light"), token(surface, "light"))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("white on the signal fill reads in both themes", () => {
    expect(contrast("#ffffff", token("signal", "dark"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", token("signal", "light"))).toBeGreaterThanOrEqual(4.5);
  });

  it("no admin component uses the signal fill as text colour", () => {
    const files = [
      "app/admin/_components/bulk-selection.tsx",
      "app/admin/_components/reorderable-list.tsx",
      "app/admin/_components/window-badge.tsx",
      ...sourceFiles("app/admin/medios"),
      ...sourceFiles("app/admin/sesiones"),
    ];

    expect(files.filter((file) => /(^|[\s"'`:])text-signal\b/.test(read(file)))).toEqual([]);
  });

  it("an expired window badge is a red fill with light text; a scheduled one keeps the sky text", () => {
    const expired = renderToStaticMarkup(createElement(WindowBadge, { badge: { label: "Vencido", detail: "desde el 1 oct" } }));
    const scheduled = renderToStaticMarkup(createElement(WindowBadge, { badge: { label: "Programado", detail: "desde el 9 nov" } }));

    expect(expired).toMatch(/bg-signal[^"]*text-destructive-foreground|text-destructive-foreground[^"]*bg-signal/);
    expect(scheduled).toContain("text-sky");
  });

  it("the emergency badge in the sessions list is a red fill with light text", () => {
    expect(read("app/admin/sesiones/page.tsx")).toMatch(/bg-signal[^"]*text-destructive-foreground[^>]*>emergencia/);
  });
});

/** Pairs of [text, surface] the admin draws from the editorial design: WCAG AA for text is 4.5:1. */
const TEXT_PAIRS: Array<[string, string]> = [
  ["on-tint-red", "tint-red"],
  ["on-tint-blue", "tint-blue"],
  ["on-tint-navy", "tint-navy"],
  ["success", "success-tint"],
];

describe("editorial design tokens (WCAG AA 4.5:1)", () => {
  it.each(TEXT_PAIRS)("%s reads on %s in both themes", (text, surface) => {
    expect(contrast(token(text, "light"), token(surface, "light"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(text, "dark"), token(surface, "dark"))).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["tint-red", "#f8e8ea"],
    ["on-tint-red", "#8d2930"],
    ["tint-blue", "#e3f2fa"],
    ["on-tint-blue", "#075a80"],
    ["tint-navy", "#e4ebf4"],
    ["on-tint-navy", "#053066"],
    ["success", "#1f7a4d"],
    ["success-tint", "#e6f4ec"],
    ["paper-ring", "#c4d2e4"],
    ["dash", "#9fb3cc"],
  ])("the light value of %s is the design's %s", (name, hex) => {
    expect(token(name, "light")).toBe(hex);
  });

  it("keeps the deep navy of the rail in both themes, with white text on it", () => {
    expect(token("deep", "light")).toBe("#03224a");
    expect(token("deep", "dark")).toBe("#03224a");
    expect(contrast("#ffffff", token("deep", "light"))).toBeGreaterThanOrEqual(4.5);
  });

  it("states the brand red as the signal role in the light theme, with white text on it", () => {
    expect(token("signal", "light")).toBe("#b7353e");
    expect(lightTokens).toMatch(/--color-signal:\s*#b7353e/);
  });

  it("reads the tints on the light page and card, not only on themselves", () => {
    for (const [text] of TEXT_PAIRS.slice(0, 3)) {
      expect(contrast(token(text, "light"), token("navy", "light"))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the existing token names the shared components read", () => {
    for (const name of ["navy", "navy-deep", "navy-lift", "sky", "signal", "error", "ok", "action", "on-action", "background", "foreground", "card", "muted", "primary", "destructive", "border", "input", "ring"]) {
      expect(css).toMatch(new RegExp(`--color-${name}:`));
    }
  });
});

describe("typography", () => {
  it("sets the admin in Mona Sans and its numbers and codes in Geist Mono", () => {
    expect(css).toMatch(/--font-sans:\s*"Mona Sans Variable"/);
    expect(css).toMatch(/--font-display:\s*"Mona Sans Variable"/);
    expect(css).toMatch(/--font-mono:\s*"Geist Mono Variable"/);
    expect(css).toMatch(/@import "@fontsource-variable\/mona-sans\/wdth\.css"/);
    expect(css).toMatch(/@import "@fontsource-variable\/geist-mono"/);
    expect(css).toMatch(/body\s*{[^}]*font-family:\s*var\(--font-sans\)/);
  });
});

describe("the «Más» sheet", () => {
  const sheet = () => renderToStaticMarkup(createElement(TabBar, { role: "ADMIN" })).match(/<dialog[^>]*>/)?.[0] ?? "";

  it("never exceeds the space above the tab bar and scrolls inside it", () => {
    const dialog = sheet();

    expect(dialog).toContain("bottom-[calc(4.25rem+env(safe-area-inset-bottom))]");
    expect(dialog).toContain("max-h-[calc(100dvh-4.25rem-env(safe-area-inset-bottom)-env(safe-area-inset-top))]");
    expect(dialog).toContain("overflow-y-auto");
  });

  it("lays the sidebar groups out in two columns, each under its label, with an icon per link", () => {
    const html = renderToStaticMarkup(createElement(TabBar, { role: "ADMIN" })).match(/<dialog[\s\S]*<\/dialog>/)?.[0] ?? "";

    expect(html).toContain("grid-cols-2");

    for (const label of ["landing/", "herramientas/", "cuenta/"]) expect(html).toContain(`>${label}</p>`);

    expect(html.match(/<a /g)?.length).toBe(html.match(/<svg /g)?.length);
    expect(html.match(/id="/g)?.length).toBe(new Set(html.match(/id="[^"]+"/g)).size);
    expect(html).not.toMatch(/id="nav-/);
  });

  it("dims the page with a colour token, not a literal black", () => {
    expect(sheet()).toContain("backdrop:bg-scrim");
    expect(sheet()).not.toContain("bg-black");
    expect(darkTokens).toMatch(/--color-scrim:/);
  });
});

describe("the toast", () => {
  it("sits below the 56 px top bar on desktop", () => {
    const bar = Number(read("app/_components/app-top-bar.tsx").match(/\bh-(\d+)\b/)?.[1]);
    const html = renderToStaticMarkup(createElement(ToastProvider, null, null));
    const top = Number(html.match(/\blg:top-(\d+)\b/)?.[1]);

    expect(bar * 0.25).toBe(3.5);
    expect(top).toBeGreaterThan(bar);
    expect(html).not.toContain("lg:top-6");
  });

  it("stacks under the top bar, so the open identity menu is never covered by it", () => {
    const bar = Number(read("app/_components/app-top-bar.tsx").match(/\bz-(\d+)\b/)?.[1]);
    const html = renderToStaticMarkup(createElement(ToastProvider, null, null));
    const toast = Number(html.match(/\bz-(\d+)\b/)?.[1]);

    expect(toast).toBeLessThan(bar);
  });
});
