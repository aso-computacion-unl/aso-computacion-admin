import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { candidatesMock, eventMock } = vi.hoisted(() => ({ candidatesMock: vi.fn(), eventMock: vi.fn() }));

vi.mock("@/interface/admin/event-registrations/registration-candidates-admin-read", () => ({ getAdminRegistrationCandidates: candidatesMock }));
vi.mock("@/interface/admin/events/events-admin-read", () => ({ getAdminEvent: eventMock }));
vi.mock("@/interface/admin/event-registrations/actions", () => ({ openEventRegistration: vi.fn(), updateEventRegistration: vi.fn() }));
// The form has its own tests; here it shows what the page hands it.
vi.mock("../../../../app/admin/registrations/_components/registration-form", () => ({
  RegistrationForm: ({ initialValues, storedValues, registeredCount, submitLabel }: Record<string, unknown>) =>
    createElement(
      "form",
      { "data-initial": JSON.stringify(initialValues), "data-stored": JSON.stringify(storedValues ?? null), "data-registered": String(registeredCount ?? 0) },
      submitLabel as string,
    ),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`);
  },
}));

import EditRegistrationPage from "../../../../app/admin/registrations/[id]/edit/page";
import NewRegistrationPage from "../../../../app/admin/registrations/new/page";

const CANDIDATES = [
  { id: "e1", title: "Taller de Git", date: "2099-11-28", datePrecision: "day", lugar: "Laboratorio 2", isPublished: true },
  { id: "e2", title: "Charla en preparación", date: null, datePrecision: "day", lugar: null, isPublished: false },
];

const renderNew = async (evento?: string) => renderToStaticMarkup(await NewRegistrationPage({ searchParams: Promise.resolve({ evento }) }));
const renderEdit = async () => renderToStaticMarkup(await EditRegistrationPage({ params: Promise.resolve({ id: "e1" }) }));

beforeEach(() => {
  candidatesMock.mockReset().mockResolvedValue(CANDIDATES);
  eventMock.mockReset().mockResolvedValue({ registrationMode: "none", registrationCapacity: null, registrationDeadline: null, registeredCount: 0 });
});

describe("creating a registration: picking the event", () => {
  it("offers each upcoming event without registration as a link, with its date, place and a mark for drafts", async () => {
    const html = await renderNew();

    expect(html).toMatch(/<h1[^>]*>Crear inscripción<\/h1>/);
    expect(html).toContain('href="/admin/registrations/new?evento=e1"');
    expect(html).toContain('href="/admin/registrations/new?evento=e2"');
    expect(html).toContain("28 nov 2099");
    expect(html).toContain("Laboratorio 2");
    expect(html).toContain("Sin fecha");
    expect(html.match(/Borrador/g)).toHaveLength(1);
    expect(html.indexOf("Charla en preparación")).toBeLessThan(html.lastIndexOf("Borrador"));
    expect(html).not.toContain("<form");
  });

  it("says there is no event to pick, and points to creating one, when none is eligible", async () => {
    candidatesMock.mockResolvedValue([]);

    const html = await renderNew();

    expect(html).toContain("No hay eventos próximos sin inscripción.");
    expect(html).toContain('href="/admin/events/new"');
  });

  it("goes back to the picker for an event that cannot take a new registration (past, already open, unknown)", async () => {
    const html = await renderNew("not-a-candidate");

    expect(html).toContain('href="/admin/registrations/new?evento=e1"');
    expect(html).not.toContain("<form");
  });
});

describe("creating a registration: the settings of the picked event", () => {
  it("shows the event's own title, date and place read-only, a link to edit the event, and the registration form", async () => {
    const html = await renderNew("e1");

    expect(html).toContain("Taller de Git");
    expect(html).toContain("28 nov 2099");
    expect(html).toContain("Laboratorio 2");
    expect(html).toContain('href="/admin/events/e1/edit"');
    expect(html).not.toMatch(/<input[^>]*name="title"/);
    expect(html).toContain('data-initial="{&quot;registrationMode&quot;:&quot;unl&quot;,&quot;registrationCapacity&quot;:&quot;&quot;,&quot;registrationDeadline&quot;:&quot;&quot;}"');
    expect(html).toContain(">Crear inscripción</form>");
    expect(html).toContain('href="/admin/registrations/new"');
  });

  it("D14: hands the form the event's stored settings (none) and the people still registered from an earlier registration", async () => {
    eventMock.mockResolvedValue({ registrationMode: "none", registrationCapacity: null, registrationDeadline: null, registeredCount: 3 });

    const html = await renderNew("e1");

    expect(eventMock).toHaveBeenCalledWith("e1");
    expect(html).toContain('data-registered="3"');
    expect(html).toContain('data-stored="{&quot;registrationMode&quot;:&quot;none&quot;,&quot;registrationCapacity&quot;:&quot;&quot;,&quot;registrationDeadline&quot;:&quot;&quot;}"');
  });

  it("marks a draft, which shows its registration on the site only once published", async () => {
    const html = await renderNew("e2");

    expect(html).toContain("Borrador");
    expect(html).toContain("Sin lugar");
  });
});

describe("editing a registration", () => {
  const event = { id: "e1", title: "Taller de Git", date: "2099-11-28", datePrecision: "day", lugar: "Laboratorio 2", isPublished: true, registrationMode: "open", registrationCapacity: 40, registrationDeadline: new Date("2099-11-27T23:00:00.000Z"), registeredCount: 7 };

  it("shows the event read-only and its registration settings prefilled, with the registered people for the D14 question", async () => {
    eventMock.mockResolvedValue(event);

    const html = await renderEdit();

    expect(eventMock).toHaveBeenCalledWith("e1");
    expect(html).toMatch(/<h1[^>]*>Configurar inscripción<\/h1>/);
    expect(html).toContain("Taller de Git");
    expect(html).toContain('href="/admin/events/e1/edit"');
    expect(html).toContain('href="/admin/registrations?evento=e1"');
    expect(html).toContain('data-initial="{&quot;registrationMode&quot;:&quot;open&quot;,&quot;registrationCapacity&quot;:&quot;40&quot;,&quot;registrationDeadline&quot;:&quot;2099-11-27T18:00&quot;}"');
    expect(html).toContain('data-registered="7"');
    expect(html).toContain(">Guardar cambios</form>");
  });

  it("sends an event without registration to «Crear inscripción»: editing never opens one", async () => {
    eventMock.mockResolvedValue({ ...event, registrationMode: "none", registrationCapacity: null, registrationDeadline: null });

    await expect(renderEdit()).rejects.toThrow("REDIRECT /admin/registrations/new?evento=e1");
  });

  it("is a 404 for an unknown event", async () => {
    eventMock.mockResolvedValue(null);

    await expect(renderEdit()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
