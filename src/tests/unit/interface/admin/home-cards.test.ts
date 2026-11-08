import { describe, expect, it } from "vitest";

import { buildHomeCards, nextOpenRegistration } from "@/interface/admin/home-cards";

const none = { openReports: 0, registration: null, draftsTotal: 0, firstDraftHref: null };

describe("the cards of 'lo que te espera'", () => {
  it("has none when nothing is waiting", () => {
    expect(buildHomeCards(none)).toEqual([]);
  });

  it("offers the open forum reports with one button to the queue", () => {
    expect(buildHomeCards({ ...none, openReports: 3 })).toEqual([
      { id: "foro", count: 3, label: "reportes en el foro", href: "/admin/foro/reportes", action: "Revisar" },
    ]);
    expect(buildHomeCards({ ...none, openReports: 1 })[0]?.label).toBe("reporte en el foro");
  });

  it("offers the registrants of the nearest open event, to that event's people", () => {
    const cards = buildHomeCards({ ...none, registration: { id: "e7", title: "Hackathon", registered: 48 } });

    expect(cards).toEqual([{ id: "inscripciones", count: 48, label: "inscritos en Hackathon", href: "/admin/registrations?evento=e7", action: "Ver inscritos" }]);
    expect(buildHomeCards({ ...none, registration: { id: "e7", title: "Hackathon", registered: 1 } })[0]?.label).toBe("inscrito en Hackathon");
  });

  it("offers the unpublished drafts, continuing with the last edited one", () => {
    expect(buildHomeCards({ ...none, draftsTotal: 2, firstDraftHref: "/admin/news/n1/edit" })).toEqual([
      { id: "contenido", count: 2, label: "borradores sin publicar", href: "/admin/news/n1/edit", action: "Continuar" },
    ]);
    expect(buildHomeCards({ ...none, draftsTotal: 1, firstDraftHref: "/admin/events/e1/edit" })[0]?.label).toBe("borrador sin publicar");
  });

  it("hides what is empty or could not be read, and keeps the order Foro, Inscripciones, Contenido", () => {
    const cards = buildHomeCards({ openReports: null, registration: { id: "e1", title: "Taller", registered: 0 }, draftsTotal: 1, firstDraftHref: "/admin/events/e2/edit" });

    expect(cards.map((card) => card.id)).toEqual(["contenido"]);
    expect(buildHomeCards({ openReports: 2, registration: { id: "e1", title: "Taller", registered: 5 }, draftsTotal: 1, firstDraftHref: "/admin/events/e2/edit" }).map((card) => card.id)).toEqual([
      "foro",
      "inscripciones",
      "contenido",
    ]);
  });
});

describe("the nearest event with registration open", () => {
  const row = (id: string, state: "open" | "full" | "closed", registered = 4) => ({ id, title: `Evento ${id}`, registered, state });

  it("is the first of the upcoming list (soonest first) that still takes registrations", () => {
    expect(nextOpenRegistration([row("a", "closed"), row("b", "full"), row("c", "open", 9), row("d", "open")])).toEqual({ id: "c", title: "Evento c", registered: 9 });
  });

  it("is nothing when none is open", () => {
    expect(nextOpenRegistration([row("a", "full")])).toBeNull();
    expect(nextOpenRegistration([])).toBeNull();
  });
});
