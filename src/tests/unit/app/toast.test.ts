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

describe("TrashButton copy (S4)", () => {
  it("offers to move to the trash, not to delete", async () => {
    const { TrashButton } = await import("../../../../app/admin/_components/row-actions");

    const html = renderToStaticMarkup(createElement(TrashButton, { label: "¿Costo?", warning: "¿Mover?", action: async () => ({ success: true as const }) }));

    expect(html).toContain("Mover a la papelera");
    expect(html).toContain('aria-label="Mover a la papelera: ¿Costo?"');
    expect(html).not.toMatch(/Eliminar/);
  });
});

describe("DeleteButton copy", () => {
  it("carries no trash wording of its own: it shows exactly the copy the caller sets", async () => {
    const { DeleteButton } = await import("../../../../app/admin/_components/row-actions");

    const html = renderToStaticMarkup(
      createElement(DeleteButton, {
        label: "Foto",
        warning: "w",
        note: "El archivo se conserva.",
        triggerLabel: "Quitar",
        confirmLabel: "Sí, quitar",
        successMessage: "Foto quitada.",
        action: async () => ({ success: true as const }),
      }),
    );

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
