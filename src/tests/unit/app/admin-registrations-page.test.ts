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
vi.mock("@/interface/admin/event-registrations/actions", () => ({ deleteEventRegistration: vi.fn() }));

import RegistrationsPage from "../../../../app/admin/registrations/page";
import EventRegistrationsPage from "../../../../app/admin/events/[id]/registrations/page";
import { cookieJar } from "@/tests/support/action-policy";
import { signInAs } from "@/tests/support/test-auth";
import { addTestEvent, testEventRegistration } from "@/tests/support/test-event-registration";

type Event = Awaited<ReturnType<typeof addTestEvent>>;

const render = async (event: Event) => renderToStaticMarkup(await RegistrationsPage({ searchParams: Promise.resolve({ evento: event.id }) }));

function register(event: Event, overrides: Partial<Parameters<typeof testEventRegistration.registrations.seed>[0]> = {}) {
  testEventRegistration.registrations.seed({ id: `${event.id}-r1`, eventId: event.id, mode: "open", name: "Ana Pérez", email: "ana@example.com", career: "Computación", semester: 5, createdAt: new Date("2026-11-20T15:30:00.000Z"), ...overrides });
}

beforeEach(async () => {
  vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
  vi.stubEnv("AUTH_URL", "http://localhost:3000");
  cookieJar(cookiesMock, await signInAs("ADMIN"));
});

describe("the old per-event URL", () => {
  it("redirects to the screen with that event selected", async () => {
    await expect(EventRegistrationsPage({ params: Promise.resolve({ id: "event-1" }) })).rejects.toThrow("REDIRECT /admin/registrations?evento=event-1");
  });
});

describe("the people of the selected event, with nobody registered yet", () => {
  it("UNL account: says why it is empty and offers the forum page to share, with the copy control", async () => {
    const html = await render(await addTestEvent({ slug: "hackathon-unl-2026", registrationMode: "unl" }));

    expect(html).toContain("Todavía no hay inscripciones.");
    expect(html).toContain("cuenta UNL");
    expect(html).toContain('value="http://localhost:3000/inscripciones/hackathon-unl-2026"');
    expect(html).toContain("Copiar link");
    expect(html).not.toContain("<table");
  });

  it("UNL account without a public origin: shows the path and names the missing setting instead of a broken link", async () => {
    vi.stubEnv("AUTH_URL", "");

    const html = await render(await addTestEvent({ slug: "hackathon-unl-2026", registrationMode: "unl" }));

    expect(html).toContain("/inscripciones/hackathon-unl-2026");
    expect(html).toContain("AUTH_URL");
    expect(html).not.toContain("Copiar link");
  });

  it("open form: points to the event card on the landing by its anchor, with no forum link", async () => {
    const html = await render(await addTestEvent({ slug: "hackathon-unl-2026", registrationMode: "open" }));

    expect(html).toContain("Todavía no hay inscripciones.");
    expect(html).toContain("formulario abierto");
    expect(html).toContain("#evento-hackathon-unl-2026");
    expect(html).not.toContain("/inscripciones/");
    expect(html).not.toContain("Copiar link");
  });

  it("a draft: the reason is that it is not public yet, and the next step is to edit it", async () => {
    const event = await addTestEvent({ registrationMode: "unl", isPublished: false });
    const html = await render(event);

    expect(html).toContain("Todavía no hay inscripciones.");
    expect(html).toContain("no está publicado");
    expect(html).toContain(`href="/admin/events/${event.id}/edit"`);
    expect(html).not.toContain("Copiar link");
  });
});

describe("the people of the selected event", () => {
  it("heads the table with the event, how it takes registrations, the seats and the closing", async () => {
    const event = await addTestEvent({ title: "Hackathon UNL 2026", registrationMode: "unl", registrationCapacity: 60 });
    register(event, { mode: "unl", career: null, semester: null });

    const html = await render(event);

    expect(html).toContain("<h2");
    expect(html).toContain("Hackathon UNL 2026");
    expect(html).toContain("Cuenta UNL");
    expect(html).toContain("1 / 60");
    expect(html).toContain("Con el día del evento");
  });

  it("lists name, email, form, career, cycle and date, with a dash where a UNL account has no career or cycle", async () => {
    const event = await addTestEvent({ registrationMode: "open" });
    register(event);
    register(event, { id: "r2", mode: "unl", name: "Luis Mora", email: "luis@unl.edu.ec", career: null, semester: null });

    const html = await render(event);

    for (const heading of ["Nombre", "Correo", "Forma", "Carrera", "Ciclo", "Inscrito"]) expect(html).toContain(`>${heading}</th>`);
    expect(html).toContain("Ana Pérez");
    expect(html).toContain("ana@example.com");
    expect(html).toContain("Computación");
    expect(html).toContain("20 nov 2026");
    expect(html).toMatch(/Luis Mora<\/th>.*Cuenta UNL<\/td><td[^>]*>—<\/td><td[^>]*>—<\/td>/);
    expect(html).not.toContain('data-slot="empty-state"');
  });

  it("an admin can export and delete, and has a quiet link to the event editor; the warning is one line", async () => {
    const event = await addTestEvent();
    register(event);

    const html = await render(event);

    expect(html).toContain(`href="/admin/events/${event.id}/registrations/export"`);
    expect(html).toContain("Exportar CSV");
    expect(html).toContain("Eliminar: inscripción de Ana Pérez");
    expect(html).toContain(`href="/admin/events/${event.id}/edit"`);
    expect(html).toContain("Editar evento");
    expect(html).toContain("Datos personales: úselos solo para organizar el evento.");
    expect(html).not.toContain("Solo un administrador");
  });

  it("an editor sees the people but gets no export and no delete, and is told why", async () => {
    cookieJar(cookiesMock, await signInAs("EDITOR"));
    const event = await addTestEvent();
    register(event);

    const html = await render(event);

    expect(html).toContain("Ana Pérez");
    expect(html).not.toContain("Exportar CSV");
    expect(html).not.toContain("/export");
    expect(html).not.toContain("Eliminar");
    expect(html).toContain(`href="/admin/events/${event.id}/edit"`);
    expect(html).toContain("Solo un administrador puede exportar o eliminar.");
  });
});
