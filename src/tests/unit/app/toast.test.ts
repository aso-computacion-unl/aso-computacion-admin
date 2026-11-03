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

describe("DeleteButton copy (S4)", () => {
  it("offers to move to the trash by default, not to delete", async () => {
    const { DeleteButton } = await import("../../../../app/admin/_components/row-actions");

    const html = renderToStaticMarkup(createElement(DeleteButton, { label: "¿Costo?", warning: "¿Mover?", action: async () => ({ success: true as const }) }));

    expect(html).toContain("Mover a la papelera");
    expect(html).toContain('aria-label="Mover a la papelera: ¿Costo?"');
    expect(html).not.toMatch(/Eliminar/);
  });

  it("keeps the image-removal wording when the caller sets its own", async () => {
    const { DeleteButton } = await import("../../../../app/admin/_components/row-actions");

    const html = renderToStaticMarkup(createElement(DeleteButton, { label: "Foto", warning: "w", triggerLabel: "Quitar", action: async () => ({ success: true as const }) }));

    expect(html).toContain("Quitar");
    expect(html).not.toContain("papelera");
  });
});

describe("RestoreButton", () => {
  it("is a button named after the item", async () => {
    const { RestoreButton } = await import("../../../../app/admin/_components/row-actions");

    const html = renderToStaticMarkup(createElement(RestoreButton, { label: "Taller", action: async () => ({ success: true as const }) }));

    expect(html).toContain("Restaurar");
    expect(html).toContain('aria-label="Restaurar: Taller"');
  });
});
