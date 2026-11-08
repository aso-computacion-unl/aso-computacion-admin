import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({ cookiesMock: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`);
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));

import RegistrationsPage, { dynamic } from "../../../../app/admin/registrations/page";
import { cookieJar } from "@/tests/support/action-policy";
import { signInAs } from "@/tests/support/test-auth";
import { addTestEvent, testEventRegistration } from "@/tests/support/test-event-registration";

const render = async (evento?: string | string[]) => renderToStaticMarkup(await RegistrationsPage({ searchParams: Promise.resolve({ evento }) }));

function register(eventId: string, count: number, name = "Persona Privada") {
  for (let index = 0; index < count; index += 1) {
    testEventRegistration.registrations.seed({ id: `${eventId}-${index}`, eventId, mode: "open", name: `${name} ${index}`, email: `privada${index}@example.com`, career: "Computación", semester: 3, createdAt: new Date() });
  }
}

/** The link that selects an event in the list, with its markup up to the closing tag. */
const linkOf = (html: string, id: string) => html.match(new RegExp(`<a [^>]*href="/admin/registrations\\?evento=${id}"[^>]*>`))?.[0] ?? "";

beforeEach(async () => {
  vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
  cookieJar(cookiesMock, await signInAs("EDITOR"));
});

describe("the registrations screen: the events", () => {
  it("is never cached", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("sends a visitor without a session to the login", async () => {
    cookieJar(cookiesMock, undefined);

    await expect(render()).rejects.toThrow("REDIRECT /login");
  });

  it("says there is nothing yet, and points to the events, when no event takes registrations", async () => {
    await addTestEvent({ registrationMode: "none" });

    const html = await render();

    expect(html).toContain("Ningún evento pide inscripción todavía.");
    expect(html).toContain('href="/admin/events"');
    expect(html).not.toContain("<table");
  });

  it("lists upcoming then past events, each a real link that selects it, with date, seats and state", async () => {
    const proximo = await addTestEvent({ title: "Taller de Git", date: "2099-11-28", registrationCapacity: 60, registrationMode: "unl" });
    const pasado = await addTestEvent({ title: "Charla antigua", date: "2020-05-10", registrationCapacity: 2 });
    const lleno = await addTestEvent({ title: "Hackathon", date: "2099-12-10", registrationCapacity: 1 });
    register(proximo.id, 48);
    register(pasado.id, 2);
    register(lleno.id, 1);

    const html = await render();

    expect(html).toContain("3 eventos · 51 inscritos");
    expect(html.indexOf("Próximos")).toBeLessThan(html.indexOf("Taller de Git"));
    expect(html.indexOf("Taller de Git")).toBeLessThan(html.indexOf("Hackathon"));
    expect(html.indexOf("Hackathon")).toBeLessThan(html.indexOf("Pasados"));
    expect(html.indexOf("Pasados")).toBeLessThan(html.indexOf("Charla antigua"));
    expect(html).toContain("28 nov 2099");
    expect(html).toContain("48 / 60");
    expect(html).toContain("Abierta");
    expect(html).toContain("Sin cupos");
    expect(html).toContain("Cerrada");
    for (const event of [proximo, pasado, lleno]) expect(linkOf(html, event.id)).not.toBe("");
  });

  it("shows an event without limit, and says why an event that is not public is not on the site", async () => {
    const libre = await addTestEvent({ title: "Charla abierta", date: "2099-12-01" });
    await addTestEvent({ title: "En preparación", date: "2099-12-02", isPublished: false });
    register(libre.id, 7);

    const html = await render();

    expect(html).toContain("7 · sin límite");
    expect(html).toContain("Borrador: no está en el sitio");
    expect(html.match(/no está en el sitio/g)).toHaveLength(1);
  });

  it("says in words what the seats mean for a screen reader", async () => {
    const limitado = await addTestEvent({ title: "Con tope", date: "2099-12-01", registrationCapacity: 40 });
    const libre = await addTestEvent({ title: "Sin tope", date: "2099-12-02" });
    register(limitado.id, 12);
    register(libre.id, 1);

    const html = await render();

    expect(html).toContain('<span aria-hidden="true">12 / 40</span><span class="sr-only">12 de 40</span>');
    expect(html).toContain('<span class="sr-only">1, sin límite</span>');
  });
});

describe("the registrations screen: which event is selected", () => {
  it("selects the nearest upcoming event that is open, and shows its people", async () => {
    const lleno = await addTestEvent({ title: "Ya lleno", date: "2099-11-01", registrationCapacity: 1 });
    const abierto = await addTestEvent({ title: "El abierto", date: "2099-12-01" });
    const lejano = await addTestEvent({ title: "El lejano", date: "2099-12-20" });
    register(lleno.id, 1, "De Lleno");
    register(abierto.id, 2, "De Abierto");
    register(lejano.id, 1, "De Lejano");

    const html = await render();

    expect(linkOf(html, abierto.id)).toContain('aria-current="true"');
    expect(linkOf(html, lleno.id)).not.toContain("aria-current");
    expect(linkOf(html, lejano.id)).not.toContain("aria-current");
    expect(html).toContain("De Abierto 0");
    expect(html).not.toMatch(/De Lleno|De Lejano/);
  });

  it("selects the first of the list when none is open", async () => {
    const primero = await addTestEvent({ title: "Primero", date: "2099-11-01", registrationCapacity: 1 });
    const segundo = await addTestEvent({ title: "Segundo", date: "2099-12-01", registrationCapacity: 1 });
    register(primero.id, 1, "De Primero");
    register(segundo.id, 1, "De Segundo");

    const html = await render();

    expect(linkOf(html, primero.id)).toContain('aria-current="true"');
    expect(html).toContain("De Primero 0");
    expect(html).not.toContain("De Segundo");
  });

  it("selects the event in ?evento=, even a past one", async () => {
    const proximo = await addTestEvent({ title: "Próximo", date: "2099-11-01" });
    const pasado = await addTestEvent({ title: "Pasado", date: "2020-05-10" });
    register(proximo.id, 1, "De Próximo");
    register(pasado.id, 1, "De Pasado");

    const html = await render(pasado.id);

    expect(linkOf(html, pasado.id)).toContain('aria-current="true"');
    expect(linkOf(html, proximo.id)).not.toContain("aria-current");
    expect(html).toContain("De Pasado 0");
    expect(html).not.toContain("De Próximo");
  });

  it("falls back to the default when ?evento= names no event that takes registrations", async () => {
    const abierto = await addTestEvent({ title: "El abierto", date: "2099-12-01" });
    const sin = await addTestEvent({ title: "Sin inscripción", registrationMode: "none" });
    register(abierto.id, 1, "De Abierto");

    for (const evento of ["no-existe", sin.id, ["a", "b"], ""]) {
      const html = await render(evento);

      expect(linkOf(html, abierto.id), String(evento)).toContain('aria-current="true"');
      expect(html).toContain("De Abierto 0");
    }
  });

  it("on a phone shows the list first, and the people with a way back once an event is chosen", async () => {
    const evento = await addTestEvent({ title: "Taller", date: "2099-12-01" });

    const list = await render();
    const people = await render(evento.id);

    // Both panes are always in the page; below `xl` only one shows.
    expect(list).toMatch(/data-pane="people"[^>]*max-xl:hidden/);
    expect(list).not.toMatch(/data-pane="events"[^>]*max-xl:hidden/);
    expect(people).toMatch(/data-pane="events"[^>]*max-xl:hidden/);
    expect(people).not.toMatch(/data-pane="people"[^>]*max-xl:hidden/);
    expect(people).toMatch(/<a [^>]*href="\/admin\/registrations"[^>]*>← Eventos<\/a>/);
  });
});
