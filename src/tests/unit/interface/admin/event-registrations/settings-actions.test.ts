import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSessionMock, revalidatePathMock, redirectMock, useCases } = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT ${path}`);
  }),
  useCases: {
    openRegistration: { execute: vi.fn() },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/interface/auth/require-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/interface/auth/require-session")>()),
  requireSession: requireSessionMock,
  requireRole: requireSessionMock,
}));
vi.mock("@/interface/admin/events/events-container", () => ({ getEventUseCases: () => useCases }));

import { NotFoundError } from "@/application";
import { ValidationError } from "@/domain";
import { PAST_EVENT_REGISTRATION_MESSAGE, REGISTRATION_ALREADY_SET_MESSAGE } from "@/domain/event-registration";
import { openEventRegistration } from "@/interface/admin/event-registrations/actions";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const SETTINGS = { registrationMode: "open", registrationCapacity: "40", registrationDeadline: "2099-11-27T18:00" };
// 18:00 in Ecuador (UTC-5) is 23:00 UTC.
const PARSED = { registrationMode: "open", registrationCapacity: 40, registrationDeadline: new Date("2099-11-27T23:00:00.000Z") };

beforeEach(() => {
  vi.clearAllMocks();
  requireSessionMock.mockResolvedValue({ kind: "user", sessionId: "s1", userId: "u1", name: "Ana", role: "EDITOR" });
  useCases.openRegistration.execute.mockResolvedValue({ id: "e1", isPublished: false });
});

describe("openEventRegistration", () => {
  it("opens the registration with the three settings only, then shows the event in the panel with the saved notice", async () => {
    await expect(openEventRegistration("e1", null, form({ ...SETTINGS, title: "ignored" }))).rejects.toThrow("REDIRECT /admin/registrations?evento=e1&guardada=1");

    expect(useCases.openRegistration.execute).toHaveBeenCalledWith({ eventId: "e1", ...PARSED });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/registrations");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/events/e1/edit");
  });

  it("shows the domain refusals in Spanish on their field, and does not leave the page", async () => {
    useCases.openRegistration.execute.mockRejectedValueOnce(new ValidationError("registrationMode", PAST_EVENT_REGISTRATION_MESSAGE));
    expect(await openEventRegistration("e1", null, form(SETTINGS))).toEqual({
      fieldErrors: { registrationMode: "El evento ya pasó: su inscripción no se puede abrir ni cambiar, solo desactivar." },
    });

    useCases.openRegistration.execute.mockRejectedValueOnce(new ValidationError("registrationMode", REGISTRATION_ALREADY_SET_MESSAGE));
    expect(await openEventRegistration("e1", null, form(SETTINGS))).toEqual({
      fieldErrors: { registrationMode: "Este evento ya tiene inscripción. Cámbiela desde «Configurar inscripción»." },
    });

    useCases.openRegistration.execute.mockRejectedValueOnce(new NotFoundError("Event not found"));
    expect(await openEventRegistration("missing", null, form(SETTINGS))).toEqual({ error: "No se encontró el evento o la foto." });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("refuses a bad capacity as a field error before reaching the use case", async () => {
    expect(await openEventRegistration("e1", null, form({ ...SETTINGS, registrationCapacity: "0" }))).toEqual({
      fieldErrors: { registrationCapacity: "Indique un número entero de 1 a 5000." },
    });
    expect(useCases.openRegistration.execute).not.toHaveBeenCalled();
  });
});
