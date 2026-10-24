import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ThemeToggle } from "../../../../../app/_components/theme-toggle";

function render(props: Parameters<typeof ThemeToggle>[0] = {}): string {
  return renderToStaticMarkup(createElement(ThemeToggle, props));
}

describe("ThemeToggle", () => {
  it("is a real button named by the action it takes, not a pressed state", () => {
    const html = render();

    expect(html).toMatch(/^<button\b/);
    expect(html).toContain('type="button"');
    expect(html).toContain("data-theme-toggle");
    expect(html).not.toContain("aria-pressed");
    expect(html).not.toContain("aria-label");
  });

  it("offers light mode while dark and dark mode while light, each label shown for one theme only", () => {
    const html = render({ showLabel: true });

    expect(html).toContain('<span class="theme-dark-only">Modo claro</span>');
    expect(html).toContain('<span class="theme-light-only">Modo oscuro</span>');
  });

  it("keeps the same per-theme names for screen readers when the button is icon-only", () => {
    const html = render();

    expect(html).toContain('<span class="sr-only theme-dark-only">Modo claro</span>');
    expect(html).toContain('<span class="sr-only theme-light-only">Modo oscuro</span>');
  });

  it("draws both icons, each shown for one theme only, and hides them from assistive tech", () => {
    const html = render();

    expect(html).toContain("theme-dark-only");
    expect(html).toContain("theme-light-only");
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(2);
  });
});
