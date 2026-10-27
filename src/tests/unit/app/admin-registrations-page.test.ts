import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { readMock } = vi.hoisted(() => ({ readMock: vi.fn() }));

vi.mock("@/interface/admin/event-registrations/registrations-admin-read", () => ({ getAdminEventRegistrations: readMock }));
vi.mock("@/interface/admin/event-registrations/actions", () => ({ deleteEventRegistration: vi.fn() }));

import EventRegistrationsPage from "../../../../app/admin/events/[id]/registrations/page";

const EVENT = {
  id: "event-1",
  slug: "hackathon-unl-2026",
  title: "Hackathon UNL 2026",
  isPublished: true,
  registrationMode: "unl" as "none" | "unl" | "open",
  registrationCapacity: 60 as number | null,
  registrationDeadline: null,
};

const registration = { id: "r1", mode: "open" as const, name: "Ana Pérez", email: "ana@example.com", career: "Computación", semester: 5, createdAt: new Date("2026-11-20T15:30:00.000Z") };

async function render(event: Partial<typeof EVENT>, registrations: (typeof registration)[] = [], adminOrigin: string | null = "http://localhost:3000") {
  readMock.mockResolvedValue({ event: { ...EVENT, ...event }, registrations, canManage: true, adminOrigin: adminOrigin ?? undefined });

  return renderToStaticMarkup(await EventRegistrationsPage({ params: Promise.resolve({ id: EVENT.id }) }));
}

beforeEach(() => {
  readMock.mockReset();
});

describe("the registrations page, with nobody registered yet", () => {
  it("UNL account: says why it is empty and offers the forum page to share, with the copy control", async () => {
    const html = await render({ registrationMode: "unl" });

    expect(html).toContain("Todavía no hay inscripciones.");
    expect(html).toContain("cuenta UNL");
    expect(html).toContain('value="http://localhost:3000/foro/eventos/hackathon-unl-2026"');
    expect(html).toContain("Copiar link");
    expect(html).not.toContain("Lista de inscripciones");
  });

  it("UNL account without a public origin: shows the path and names the missing setting instead of a broken link", async () => {
    const html = await render({ registrationMode: "unl" }, [], null);

    expect(html).toContain("/foro/eventos/hackathon-unl-2026");
    expect(html).toContain("AUTH_URL");
    expect(html).not.toContain("Copiar link");
  });

  it("open form: points to the event card on the landing by its anchor, with no forum link", async () => {
    const html = await render({ registrationMode: "open" });

    expect(html).toContain("Todavía no hay inscripciones.");
    expect(html).toContain("formulario abierto");
    expect(html).toContain("#evento-hackathon-unl-2026");
    expect(html).not.toContain("/foro/eventos/");
    expect(html).not.toContain("Copiar link");
  });

  it("no registration: says the event does not ask for one and sends to its edit page", async () => {
    const html = await render({ registrationMode: "none" });

    expect(html).toContain("Este evento no pide inscripción.");
    expect(html).toContain('href="/admin/events/event-1/edit"');
    expect(html).not.toContain("Todavía no hay inscripciones.");
    expect(html).not.toContain("Copiar link");
  });

  it("a draft: the reason is that it is not public yet, and the next step is to edit it", async () => {
    const html = await render({ registrationMode: "unl", isPublished: false });

    expect(html).toContain("Todavía no hay inscripciones.");
    expect(html).toContain("no está publicado");
    expect(html).toContain('href="/admin/events/event-1/edit"');
    expect(html).not.toContain("Copiar link");
  });
});

describe("the registrations page, with registrations", () => {
  it("lists them in the table and shows no empty state", async () => {
    const html = await render({ registrationMode: "open" }, [registration]);

    expect(html).toContain("Ana Pérez");
    expect(html).not.toContain('data-slot="empty-state"');
  });
});
