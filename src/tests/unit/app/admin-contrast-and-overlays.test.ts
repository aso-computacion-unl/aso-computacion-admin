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

describe("the «Más» sheet", () => {
  const sheet = () => renderToStaticMarkup(createElement(TabBar, { role: "ADMIN" })).match(/<dialog[^>]*>/)?.[0] ?? "";

  it("never exceeds the space above the tab bar and scrolls inside it", () => {
    const dialog = sheet();

    expect(dialog).toContain("bottom-[calc(4.25rem+env(safe-area-inset-bottom))]");
    expect(dialog).toContain("max-h-[calc(100dvh-4.25rem-env(safe-area-inset-bottom)-env(safe-area-inset-top))]");
    expect(dialog).toContain("overflow-y-auto");
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
});
