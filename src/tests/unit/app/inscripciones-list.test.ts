import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { memberMock } = vi.hoisted(() => ({ memberMock: vi.fn() }));

vi.mock("@/interface/forum/require-forum-member", () => ({ getForumMember: memberMock }));

import RegistrationsListPage, { metadata } from "../../../../app/inscripciones/page";
import { addTestEvent, testEventRegistration } from "@/tests/support/test-event-registration";

const render = async (query: { error?: string | string[] } = {}) => renderToStaticMarkup(await RegistrationsListPage({ searchParams: Promise.resolve(query) }));
const cards = (html: string) => html.match(/<li[\s>][\s\S]*?<\/li>/g) ?? [];

function seedRegistration(eventId: string, id: string, mode: "unl" | "open" = "unl") {
  testEventRegistration.registrations.seed({ id, eventId, mode, name: "Ana", email: `${id}@unl.edu.ec`, career: null, semester: null, createdAt: new Date() });
}

beforeEach(() => {
  vi.clearAllMocks();
  memberMock.mockResolvedValue(null);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("D8: /inscripciones is a public list of the events taking registrations", () => {
  it("is titled Inscripciones (with the site name, as its own segment gets no template) and heads the page with it, as its one h1", async () => {
    const html = await render();

    expect(metadata.title).toEqual({ absolute: "Inscripciones — ASO Computación" });
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Inscripciones<\/h1>/);
  });

  it("needs no session: it renders for a visitor with no cookies and offers no sign-in at all", async () => {
    await addTestEvent({ title: "Taller de Docker", registrationMode: "unl", date: "2099-11-28" });

    const html = await render();

    expect(html).toContain("Taller de Docker");
    expect(html).not.toContain("Entrar con Google");
    expect(html).not.toContain("auth/google");
    expect(html).not.toContain("Su pase de estudiante");
  });

  it("lists the UNL events and the open-form events alike, each linking to its page and saying how it takes registrations", async () => {
    const unl = await addTestEvent({ title: "Taller de Docker", registrationMode: "unl", date: "2099-11-28" });
    const open = await addTestEvent({ title: "Charla abierta al público", registrationMode: "open", date: "2099-12-05" });

    const html = await render();
    const [first, second] = cards(html);

    expect(cards(html)).toHaveLength(2);
    expect(first).toContain(`href="/inscripciones/${unl.slug}"`);
    expect(first).toContain("Cuenta UNL");
    expect(second).toContain(`href="/inscripciones/${open.slug}"`);
    expect(second).toContain("Abierto al público");
  });

  it("puts the upcoming events first, soonest first, and the undated last", async () => {
    await addTestEvent({ title: "Hackathon UNL 2026", registrationMode: "unl", date: "2099-12-15" });
    await addTestEvent({ title: "Meetup sin fecha", registrationMode: "open", date: null });
    await addTestEvent({ title: "Taller de Docker", registrationMode: "unl", date: "2099-11-28" });

    const html = await render();

    expect(html.indexOf("Taller de Docker")).toBeLessThan(html.indexOf("Hackathon UNL 2026"));
    expect(html.indexOf("Hackathon UNL 2026")).toBeLessThan(html.indexOf("Meetup sin fecha"));
  });

  it("shows the date on each card's stub and the seats left live, in the singular for one", async () => {
    const taller = await addTestEvent({ title: "Taller de Docker", registrationMode: "unl", registrationCapacity: 30, date: "2099-11-28", hora: "09:00 - 11:00", lugar: "Laboratorio 2" });
    seedRegistration(taller.id, "r1");
    const casi = await addTestEvent({ title: "Casi lleno", registrationMode: "open", registrationCapacity: 2, date: "2099-12-01" });
    seedRegistration(casi.id, "r2", "open");
    await addTestEvent({ title: "Sin límite", registrationMode: "open", date: "2099-12-02" });

    const [first, second, third] = cards(await render());

    expect(first).toMatch(/reg-card-day[^>]*>28</);
    expect(first).toContain("nov 2099");
    expect(first).toContain("Quedan 29 cupos");
    expect(first).toContain("09:00 - 11:00");
    expect(first).toContain("Laboratorio 2");
    expect(second).toContain("Queda 1 cupo");
    expect(third).toContain("Sin límite de cupos");
  });

  it("gives each event its own h3 (under its month's h2) with the link to its page, and the description under it when there is one", async () => {
    await addTestEvent({ title: "Taller de Docker", registrationMode: "unl", date: "2099-11-28", description: "Contenedores desde cero." });
    await addTestEvent({ title: "Meetup sin texto", registrationMode: "open", date: "2099-12-02" });

    const [first, second] = cards(await render());

    expect(first).toMatch(/<h3[^>]*><a [^>]*href="\/inscripciones\/taller-de-docker"[^>]*>Taller de Docker<\/a><\/h3>/);
    expect(first).toContain("Contenedores desde cero.");
    expect(second).not.toContain("reg-card-desc");
  });

  it("leaves out what cannot take a registration right now: past, full, closed, free entry and drafts", async () => {
    await addTestEvent({ title: "Abierto", registrationMode: "unl", date: "2099-11-28" });
    await addTestEvent({ title: "Taller que ya pasó", registrationMode: "unl", date: "2020-01-10" });
    await addTestEvent({ title: "Plazo vencido", registrationMode: "open", registrationDeadline: new Date("2020-01-01T00:00:00Z") });
    await addTestEvent({ title: "Pase libre", registrationMode: "none" });
    await addTestEvent({ title: "Borrador", registrationMode: "unl", isPublished: false });
    const lleno = await addTestEvent({ title: "Taller lleno", registrationMode: "open", registrationCapacity: 1, date: "2099-12-01" });
    seedRegistration(lleno.id, "r1", "open");

    const html = await render();

    expect(cards(html)).toHaveLength(1);
    for (const hidden of ["ya pasó", "Plazo vencido", "Pase libre", "Borrador", "Taller lleno"]) expect(html).not.toContain(hidden);
  });

  it("lists more than five open events: the page shows them all", async () => {
    for (let day = 1; day <= 7; day += 1) await addTestEvent({ title: `Evento ${day}`, registrationMode: day % 2 ? "unl" : "open", date: `2099-12-${String(day).padStart(2, "0")}` });

    expect(cards(await render())).toHaveLength(7);
  });

  it("says so, in registration words, while no event is open, with no list and no leftover count", async () => {
    await addTestEvent({ title: "Pase libre", registrationMode: "none" });

    const html = await render();

    expect(html).toContain("No hay inscripciones abiertas.");
    expect(html).toContain("Cuando la directiva abra una, la verá aquí.");
    expect(cards(html)).toHaveLength(0);
    expect(html).not.toContain('href="/inscripciones/');
  });

  it("never speaks of the forum: no word, no link", async () => {
    await addTestEvent({ title: "Taller de Docker", registrationMode: "unl", date: "2099-11-28" });

    for (const html of [await render(), (testEventRegistration.events.clear(), await render())]) {
      expect(html).not.toMatch(/foro/i);
      expect(html).not.toContain('href="/foro');
    }
  });

  it("counts the open events in its kicker, in the singular for one", async () => {
    await addTestEvent({ title: "Taller de Docker", registrationMode: "unl", date: "2099-11-28" });
    expect(await render()).toContain("1 evento con inscripción abierta");

    await addTestEvent({ title: "Charla", registrationMode: "open", date: "2099-12-05" });
    expect(await render()).toContain("2 eventos con inscripción abierta");
  });
});

const member = { memberId: "m1", sessionId: "s1", displayName: "María Cuenca", email: "maria.cuenca@unl.edu.ec" };
const stubs = (html: string) => html.match(/<nav[^>]*aria-label="Filtrar por mes"[^>]*>[\s\S]*?<\/nav>/)?.[0] ?? "";
const buttons = (html: string) => stubs(html).match(/<button[\s\S]*?<\/button>/g) ?? [];
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("S4: the month filter, one ticket stub per month", () => {
  it("offers Todos with the total and one stub per month, the full month name over its count, Todos pressed", async () => {
    await addTestEvent({ title: "Linux", registrationMode: "open", date: "2099-11-14" });
    await addTestEvent({ title: "Git", registrationMode: "open", date: "2099-11-21" });
    await addTestEvent({ title: "Hackathon", registrationMode: "unl", date: "2099-12-02" });

    const html = await render();
    const [all, november, december, ...rest] = buttons(html);

    expect(rest).toEqual([]);
    expect(text(all!)).toBe("Todos 3 eventos");
    expect(all).toContain('aria-pressed="true"');
    expect(text(november!)).toBe("Noviembre 2 eventos");
    expect(november).toContain('aria-pressed="false"');
    expect(text(december!)).toBe("Diciembre 1 evento");
    expect(stubs(html)).not.toMatch(/>\s*(nov|dic)\b/i);
    expect(html).toMatch(/role="status"[^>]*>Mostrando los 3 eventos</);
  });

  it("is left out when every open event falls in the same month", async () => {
    await addTestEvent({ title: "Linux", registrationMode: "open", date: "2099-11-14" });
    await addTestEvent({ title: "Git", registrationMode: "open", date: "2099-11-21" });

    const html = await render();

    expect(html).not.toContain("Filtrar por mes");
    expect(html).not.toContain("Mostrando");
  });
});

describe("S5: a long list grouped by month, soonest first", () => {
  it("splits the events under an h2 per month, and adds the year when the list spans more than one", async () => {
    await addTestEvent({ title: "Cierre de ciclo", registrationMode: "unl", date: "2099-12-18" });
    await addTestEvent({ title: "Bienvenida", registrationMode: "unl", date: "2100-01-16" });

    const html = await render();
    const headings = [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((match) => match[1]);

    expect(headings).toEqual(["Diciembre 2099", "Enero 2100"]);
    expect(html.indexOf(">Diciembre 2099</h2>")).toBeLessThan(html.indexOf("Cierre de ciclo"));
    expect(html.indexOf("Cierre de ciclo")).toBeLessThan(html.indexOf(">Enero 2100</h2>"));
  });

  it("names the month alone while the list stays in one year", async () => {
    await addTestEvent({ title: "Linux", registrationMode: "open", date: "2099-11-14" });
    await addTestEvent({ title: "Hackathon", registrationMode: "unl", date: "2099-12-02" });

    const headings = [...(await render()).matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((match) => match[1]);

    expect(headings).toEqual(["Noviembre", "Diciembre"]);
  });

  it("tags each row with who can register: Abierto al público or Cuenta UNL", async () => {
    await addTestEvent({ title: "Linux", registrationMode: "open", date: "2099-11-14" });
    await addTestEvent({ title: "Hackathon", registrationMode: "unl", date: "2099-11-28" });

    const [open, unl] = cards(await render());

    expect(open).toContain("Abierto al público");
    expect(unl).toContain("Cuenta UNL");
    expect(unl).not.toContain("Con cuenta UNL");
  });
});

describe("S6: the row's action goes to the event's page, which owns the sign-in and the reservation", () => {
  it("asks a visitor to sign in for a UNL event and to register for an open one", async () => {
    const open = await addTestEvent({ title: "Linux", registrationMode: "open", date: "2099-11-14" });
    const unl = await addTestEvent({ title: "Hackathon", registrationMode: "unl", date: "2099-11-28" });

    const [first, second] = cards(await render());

    expect(first).toMatch(new RegExp(`<a [^>]*href="/inscripciones/${open.slug}"[^>]*>Inscribirme</a>`));
    expect(second).toMatch(new RegExp(`<a [^>]*href="/inscripciones/${unl.slug}"[^>]*>Entrar para inscribirme</a>`));
  });

  it("asks a signed-in student to register for either kind", async () => {
    memberMock.mockResolvedValue(member);
    const unl = await addTestEvent({ title: "Hackathon", registrationMode: "unl", date: "2099-11-28" });

    const [row] = cards(await render());

    expect(row).toMatch(new RegExp(`<a [^>]*href="/inscripciones/${unl.slug}"[^>]*>Inscribirme</a>`));
    expect(row).not.toContain("Entrar para inscribirme");
  });
});

describe("S7: the lead says what the page is for", () => {
  it("tells a visitor they reserve in a minute", async () => {
    expect(await render()).toContain("Talleres, charlas y encuentros de la carrera. Reserve su cupo en un minuto.");
  });

  it("tells a signed-in student they register in one click", async () => {
    memberMock.mockResolvedValue(member);

    const html = await render();

    expect(html).toContain("Talleres, charlas y encuentros de la carrera. Con su cuenta UNL se inscribe con un clic.");
    expect(html).not.toContain("Reserve su cupo en un minuto.");
  });
});

describe("S8: the empty list stays as it was", () => {
  it("shows no filter and no month heading while nothing is open", async () => {
    const html = await render();

    expect(html).toContain("No hay inscripciones abiertas.");
    expect(html).not.toContain("Filtrar por mes");
    expect(html.match(/<h2/g)).toHaveLength(1);
  });
});

describe("S1: a sign-in started from the header comes back to the list", () => {
  it("says why it failed, in registration words", async () => {
    const html = await render({ error: "denied" });

    expect(html).toMatch(/role="alert"[^>]*>Esa cuenta no puede entrar. Use su correo institucional @unl.edu.ec.</);
  });

  it("ignores an error code it does not know", async () => {
    expect(await render({ error: "whatever" })).not.toContain('role="alert"');
  });
});
