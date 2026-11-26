import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RegistrationsEmptyState } from "../../../../app/admin/registrations/_components/registrations-empty-state";

describe("RegistrationsEmptyState", () => {
  it("leads an event without registration to «Crear inscripción» in Inscripciones, not to the event form (S3)", () => {
    const html = renderToStaticMarkup(createElement(RegistrationsEmptyState, { eventId: "e1", slug: "taller", mode: "none", isPublished: true, isOver: false, adminOrigin: undefined }));

    expect(html).toContain("Créela desde Inscripciones");
    expect(html).toMatch(/<a [^>]*href="\/admin\/registrations\/new\?evento=e1"[^>]*>Crear inscripción<\/a>/);
    expect(html).not.toContain("/admin/events/e1/edit");
  });

  it("offers no «Crear inscripción» for a past event without registration: the picker and the server refuse it", () => {
    const html = renderToStaticMarkup(createElement(RegistrationsEmptyState, { eventId: "e1", slug: "taller", mode: "none", isPublished: true, isOver: true, adminOrigin: undefined }));

    expect(html).toContain("Este evento no pide inscripción.");
    expect(html).not.toContain("/admin/registrations/new");
    expect(html).not.toContain("Créela");
  });
});
