import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SectionTitle } from "../../../../app/admin/_components/section-title";

const render = (props: Partial<Parameters<typeof SectionTitle>[0]> = {}) => renderToStaticMarkup(createElement(SectionTitle, props, "Fotos"));

describe("SectionTitle", () => {
  it("is a level-2 heading in the admin's one section style", () => {
    const html = render({ id: "fotos" });

    expect(html).toMatch(/^<h2 class="[^"]*text-lg font-bold font-stretch-\[112%\][^"]*" id="fotos">Fotos<\/h2>$/);
  });

  it("has a quiet label variant for the groups of a list", () => {
    const html = render({ variant: "label" });

    expect(html).toContain("uppercase");
    expect(html).toContain("text-mist");
    expect(html).not.toContain("text-lg");
  });

  it("takes extra classes and can be hidden from sight but not from screen readers", () => {
    expect(render({ className: "mb-4" })).toContain("mb-4");
    expect(render({ className: "sr-only" })).toContain("sr-only");
  });
});
