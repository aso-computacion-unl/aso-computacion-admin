import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RegistrationsListPage, { metadata } from "../../../../app/inscripciones/page";
import { addTestEvent, testEventRegistration } from "@/tests/support/test-event-registration";

const render = async () => renderToStaticMarkup(await RegistrationsListPage());
const cards = (html: string) => html.match(/<li[\s>][\s\S]*?<\/li>/g) ?? [];

function seedRegistration(eventId: string, id: string, mode: "unl" | "open" = "unl") {
  testEventRegistration.registrations.seed({ id, eventId, mode, name: "Ana", email: `${id}@unl.edu.ec`, career: null, semester: null, createdAt: new Date() });
}

beforeEach(() => {
  vi.clearAllMocks();
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
    expect(first).toContain("Con cuenta UNL");
    expect(second).toContain(`href="/inscripciones/${open.slug}"`);
    expect(second).toContain("Abierta al público");
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

  it("gives each event its own h2 with the link to its page, and the description under it when there is one", async () => {
    await addTestEvent({ title: "Taller de Docker", registrationMode: "unl", date: "2099-11-28", description: "Contenedores desde cero." });
    await addTestEvent({ title: "Meetup sin texto", registrationMode: "open", date: "2099-12-02" });

    const [first, second] = cards(await render());

    expect(first).toMatch(/<h2[^>]*><a [^>]*href="\/inscripciones\/taller-de-docker"[^>]*>Taller de Docker<\/a><\/h2>/);
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
