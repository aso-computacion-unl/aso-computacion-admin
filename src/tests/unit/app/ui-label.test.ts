import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Label } from "../../../../components/ui/label";

describe("Label", () => {
  it("points at its control through htmlFor", () => {
    const html = renderToStaticMarkup(createElement(Label, { htmlFor: "email", className: "extra" }, "Email"));

    expect(html).toContain('for="email"');
    expect(html).toContain("extra");
    expect(html).toContain(">Email</label>");
  });

  it("wraps its control when there is no htmlFor, and keeps the other attributes", () => {
    const html = renderToStaticMarkup(createElement(Label, { id: "wrapper" }, createElement("input", { name: "x" })));

    expect(html).not.toContain("for=");
    expect(html).toContain('id="wrapper"');
    expect(html).toContain('<input name="x"/>');
  });
});
