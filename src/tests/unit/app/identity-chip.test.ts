import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IdentityChip, chipName } from "../../../../app/_components/identity-chip";

const FULL = "Alejandro Emanuel Padilla Encalada";

describe("chipName", () => {
  it("keeps the first given name and the first surname of a four-part name, so it fits the top bar", () => {
    expect(chipName(FULL)).toBe("Alejandro Padilla");
    expect(chipName("  María   José  Pérez   Gómez ")).toBe("María Pérez");
  });

  it("leaves names of up to three parts whole, since it cannot tell a second given name from a second surname", () => {
    expect(chipName("Ana Pérez")).toBe("Ana Pérez");
    expect(chipName("Ana Pérez Gómez")).toBe("Ana Pérez Gómez");
    expect(chipName("Ana")).toBe("Ana");
  });
});

describe("IdentityChip", () => {
  const html = renderToStaticMarkup(createElement(IdentityChip, { name: FULL, roleLabel: "Administrador", signOut: null }));

  it("shows the short name in the bar, with the full one as its tooltip", () => {
    expect(html).toMatch(/<span title="Alejandro Emanuel Padilla Encalada"[^>]*>Alejandro Padilla<\/span>/);
  });

  it("names the person in full inside the menu on every screen size, and in the button's accessible name", () => {
    expect(html).toMatch(/<span class="text-sm font-semibold wrap-anywhere">Alejandro Emanuel Padilla Encalada<\/span>/);
    expect(html).toContain(`aria-label="Menú de cuenta: ${FULL}, Administrador"`);
  });
});
