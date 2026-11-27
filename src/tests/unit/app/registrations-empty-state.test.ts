import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RegistrationsEmptyState } from "../../../../app/admin/registrations/_components/registrations-empty-state";

describe("RegistrationsEmptyState", () => {
  it("an announcement never takes registration: no «Crear inscripción», on any date (event-kinds S1)", () => {
    const html = renderToStaticMarkup(createElement(RegistrationsEmptyState, { eventId: "e1", slug: "taller", mode: "none", isPublished: true, adminOrigin: undefined }));

    expect(html).toContain("Este evento no pide inscripción.");
    expect(html).not.toContain("/admin/registrations/new");
    expect(html).not.toContain("Créela");
  });
});
