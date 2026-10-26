import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ToastProvider, useToast } from "../../../../app/admin/_components/toast";

describe("ToastProvider", () => {
  it("renders its children next to an always-mounted polite live region", () => {
    const html = renderToStaticMarkup(createElement(ToastProvider, null, createElement("p", null, "contenido")));

    expect(html).toContain("<p>contenido</p>");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="status"');
  });

  it("lets a component outside a provider call notify without throwing", () => {
    function Probe() {
      useToast().notify("hola");
      return createElement("span", null, "ok");
    }

    expect(renderToStaticMarkup(createElement(Probe))).toBe("<span>ok</span>");
  });
});
