import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { eventMock, createEventWithRegistrationMock } = vi.hoisted(() => ({ eventMock: vi.fn(), createEventWithRegistrationMock: vi.fn() }));

vi.mock("@/interface/admin/events/events-admin-read", () => ({ getAdminEvent: eventMock }));
vi.mock("@/interface/admin/event-registrations/actions", () => ({ updateEventRegistration: vi.fn() }));
vi.mock("@/interface/admin/events/actions", () => ({ createEventWithRegistration: createEventWithRegistrationMock }));
// The event form has its own tests (admin-event-editor.test.ts); here it shows what the page hands it.
vi.mock("../../../../app/admin/events/_components/event-form", () => ({
  EventForm: ({ action, fixedKind, submitLabel }: Record<string, unknown>) =>
    createElement("form", { "data-event-form": "", "data-fixed-kind": String(fixedKind), "data-action": action === createEventWithRegistrationMock ? "createEventWithRegistration" : "other" }, submitLabel as string),
}));
// The form has its own tests; here it shows what the page hands it.
vi.mock("../../../../app/admin/registrations/_components/registration-form", () => ({
  RegistrationForm: ({ initialValues, registeredCount, submitLabel }: Record<string, unknown>) =>
    createElement("form", { "data-initial": JSON.stringify(initialValues), "data-registered": String(registeredCount ?? 0) }, submitLabel as string),
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

const renderNew = async () => renderToStaticMarkup(await NewRegistrationPage());
const renderEdit = async () => renderToStaticMarkup(await EditRegistrationPage({ params: Promise.resolve({ id: "e1" }) }));

beforeEach(() => {
  eventMock.mockReset().mockResolvedValue({ registrationMode: "none", registrationCapacity: null, registrationDeadline: null, registeredCount: 0 });
});

describe("creating a registration (event-kinds S3, S4)", () => {
  it("is one form for a new event with its registration, the kind already fixed: no event to pick", async () => {
    const html = await renderNew();

    expect(html).toMatch(/<h1[^>]*>Crear inscripción<\/h1>/);
    expect(html).toContain('data-fixed-kind="registration"');
    expect(html).toContain('data-action="createEventWithRegistration"');
    expect(html).toContain(">Crear inscripción</form>");
    expect(html).toContain('href="/admin/registrations"');
    expect(html).not.toContain("?evento=");
    expect(eventMock).not.toHaveBeenCalled();
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

  it("sends an announcement back to the registrations panel: editing never opens a registration (event-kinds S1)", async () => {
    eventMock.mockResolvedValue({ ...event, registrationMode: "none", registrationCapacity: null, registrationDeadline: null });

    await expect(renderEdit()).rejects.toThrow(/^REDIRECT \/admin\/registrations$/);
  });

  it("is a 404 for an unknown event", async () => {
    eventMock.mockResolvedValue(null);

    await expect(renderEdit()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
