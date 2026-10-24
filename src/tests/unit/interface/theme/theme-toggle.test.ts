import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ThemeToggle } from "../../../../../app/_components/theme-toggle";

function render(props: Parameters<typeof ThemeToggle>[0] = {}): string {
  return renderToStaticMarkup(createElement(ThemeToggle, props));
}

describe("ThemeToggle", () => {
  it("is a real button with a Spanish name and the dark default pressed", () => {
    const html = render();

    expect(html).toMatch(/^<button\b/);
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="Modo oscuro"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("data-theme-toggle");
  });

  it("draws both icons, each shown for one theme only, and hides them from assistive tech", () => {
    const html = render();

    expect(html).toContain("theme-dark-only");
    expect(html).toContain("theme-light-only");
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(2);
  });

  it("shows the visible label instead of an aria-label when asked, so the name matches the text", () => {
    const html = render({ showLabel: true });

    expect(html).toContain(">Modo oscuro</span>");
    expect(html).not.toContain("aria-label");
  });
});
