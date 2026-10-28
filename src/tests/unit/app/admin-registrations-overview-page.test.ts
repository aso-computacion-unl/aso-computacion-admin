import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({ cookiesMock: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`);
  },
}));

import RegistrationsOverviewPage, { dynamic } from "../../../../app/admin/registrations/page";
import { cookieJar } from "@/tests/support/action-policy";
import { signInAs } from "@/tests/support/test-auth";
import { addTestEvent, testEventRegistration } from "@/tests/support/test-event-registration";

const render = async () => renderToStaticMarkup(await RegistrationsOverviewPage());

function register(eventId: string, count: number) {
  for (let index = 0; index < count; index += 1) {
    testEventRegistration.registrations.seed({ id: `${eventId}-${index}`, eventId, mode: "open", name: `Persona Privada ${index}`, email: `privada${index}@example.com`, career: "Computación", semester: 3, createdAt: new Date() });
  }
}

beforeEach(async () => {
  vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
  cookieJar(cookiesMock, await signInAs("EDITOR"));
});

describe("the registrations overview page", () => {
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

  it("lists upcoming then past events with date, mode, seats, deadline, state and a link to each event's registrants", async () => {
    const proximo = await addTestEvent({ title: "Taller de Git", date: "2099-11-28", registrationCapacity: 60, registrationMode: "unl", registrationDeadline: new Date("2099-11-27T23:00:00.000Z") });
    const pasado = await addTestEvent({ title: "Charla antigua", date: "2020-05-10", registrationCapacity: 2 });
    const lleno = await addTestEvent({ title: "Hackathon", date: "2099-12-10", registrationCapacity: 1 });
    register(proximo.id, 48);
    register(pasado.id, 2);
    register(lleno.id, 1);

    const html = await render();

    expect(html.indexOf("Próximos")).toBeGreaterThan(-1);
    expect(html.indexOf("Próximos")).toBeLessThan(html.indexOf("Taller de Git"));
    expect(html.indexOf("Taller de Git")).toBeLessThan(html.indexOf("Hackathon"));
    expect(html.indexOf("Hackathon")).toBeLessThan(html.indexOf("Pasados"));
    expect(html.indexOf("Pasados")).toBeLessThan(html.indexOf("Charla antigua"));
    expect(html).toContain("3 eventos · 51 inscritos");
    expect(html).toContain("28 nov 2099");
    expect(html).toContain("Cuenta UNL");
    expect(html).toContain("Formulario abierto");
    expect(html).toContain("48 / 60");
    expect(html).toContain("Abierta");
    expect(html).toContain("Sin cupos");
    expect(html).toContain("Cerrada");
    expect(html).toContain("Con el día del evento");
    expect(html).toContain(`href="/admin/events/${proximo.id}/registrations"`);
    expect(html).toContain(`href="/admin/events/${pasado.id}/registrations"`);
    expect(html).toContain("Ver inscritos<span class=\"sr-only\"> de Taller de Git</span>");
  });

  it("shows an event without limit, and says why an event that is not public is not on the site", async () => {
    const libre = await addTestEvent({ title: "Charla abierta", date: "2099-12-01" });
    await addTestEvent({ title: "En preparación", date: "2099-12-02", isPublished: false });
    register(libre.id, 7);

    const html = await render();

    expect(html).toContain("7 · sin límite");
    expect(html).toContain("Borrador: no está en el sitio");
    // The stacked list and the table each say it once; only one of them shows at a time.
    expect(html.match(/no está en el sitio/g)).toHaveLength(2);
  });

  it("says in words what the seats and the closing of each event mean", async () => {
    const limitado = await addTestEvent({ title: "Con tope", date: "2099-12-01", registrationCapacity: 40, registrationDeadline: new Date("2099-11-27T23:00:00.000Z") });
    const sinFecha = await addTestEvent({ title: "Sin día", date: null });
    await addTestEvent({ title: "De todo el mes", date: "2099-12-01", datePrecision: "month" });
    await addTestEvent({ title: "De un día", date: "2099-12-05" });
    register(limitado.id, 12);
    register(sinFecha.id, 1);

    const html = await render();

    // The screen reader gets "12 de 40" instead of "12 slash 40"; the slash and the dot stay for the eyes only.
    expect(html).toContain('<span aria-hidden="true">12 / 40</span><span class="sr-only">12 de 40</span>');
    expect(html).toContain('<span class="sr-only">1, sin límite</span>');
    // The time of the deadline never breaks before "p. m.".
    expect(html).toContain("6:00\u00a0p.\u00a0m.");
    expect(html).toContain("Sin cierre");
    expect(html).toContain("Al terminar el mes");
    expect(html).toContain("Con el día del evento");
  });

  it("gives every event a stacked block for narrow screens beside the table, and names each section only once", async () => {
    await addTestEvent({ title: "Uno", date: "2099-12-01" });
    await addTestEvent({ title: "Dos", date: "2099-12-02" });

    const html = await render();

    expect(html.match(/<li /g)).toHaveLength(2);
    expect(html.match(/<tr /g)).toHaveLength(3); // the header and one per event
    expect(html.match(/aria-labelledby="registrations-upcoming"/g)).toHaveLength(1);
    expect(html.match(/aria-label=/g)).toBeNull();
  });

  it("shows counts only: nothing of the people registered", async () => {
    register((await addTestEvent()).id, 3);

    expect(await render()).not.toMatch(/Persona Privada|privada\d@example\.com|Computación/);
  });
});
