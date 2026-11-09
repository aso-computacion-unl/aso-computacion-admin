import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSessionMock, revalidatePathMock, redirectMock, useCases } = vi.hoisted(() => {
  const execute = () => vi.fn();

  return {
    requireSessionMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    redirectMock: vi.fn(() => {
      throw new Error("REDIRECT");
    }),
    useCases: {
      create: { execute: execute() },
      update: { execute: execute() },
      get: { execute: execute() },
      registeredCount: vi.fn(),
      setPublished: { execute: execute() },
      trash: { execute: execute() },
      attachPhoto: { execute: execute() },
      updatePhotoAlt: { execute: execute() },
      reorderPhotos: { execute: execute() },
      deactivatePhoto: { execute: execute() },
    },
  };
});

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/interface/auth/require-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/interface/auth/require-session")>()),
  requireSession: requireSessionMock,
  requireRole: requireSessionMock,
}));
vi.mock("@/interface/admin/events/events-container", () => ({ getEventUseCases: () => useCases }));

import { ImageTooSmallError, ValidationError } from "@/domain";
import { NotFoundError } from "@/application";
import * as actions from "@/interface/admin/events/actions";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function photoForm(file: File, alt = "Equipo en el hackatón"): FormData {
  const data = form({ alt });
  data.set("file", file);
  return data;
}

const jpeg = (size = 4) => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(size).fill(1)])], "a.jpg", { type: "image/jpeg" });

describe("events server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({ kind: "user", sessionId: "s1", userId: "u1", name: "Ana", role: "ADMIN" });
    useCases.trash.execute.mockResolvedValue({ wasPublished: true });
    // An event without registration and nobody registered: no change to ask about unless a test arranges it.
    useCases.get.execute.mockResolvedValue({ id: "e1", registrationMode: "none", registrationCapacity: null });
    useCases.registeredCount.mockResolvedValue(0);
  });

  describe("createEvent", () => {
    it("parses the form, creates the event and redirects to its edit page, flagged as just created and aimed at the photos", async () => {
      useCases.create.execute.mockResolvedValue({ id: "new-id" });

      await expect(
        actions.createEvent(
          null,
          form({
            title: "  Hackatón 24h ",
            slug: "",
            description: "Un día de código",
            date: "2026-11-28",
            type: "evento",
            hora: "09:00",
            featured: "on",
            linkUrl: "https://aso.test",
            linkLabel: "Inscribirme",
            highlights: "Apertura\n\n  Retos  \n",
          }),
        ),
      ).rejects.toThrow("REDIRECT");

      expect(useCases.create.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Hackatón 24h",
          slug: undefined,
          description: "Un día de código",
          date: "2026-11-28",
          type: "evento",
          hora: "09:00",
          featured: true,
          isPublished: false,
          linkUrl: "https://aso.test",
          linkLabel: "Inscribirme",
          highlights: ["Apertura", "Retos"],
        }),
      );
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/events");
      expect(redirectMock).toHaveBeenCalledWith("/admin/events/new-id/edit?creado=1#fotos");
    });

    it("passes a month-only date through to the use case", async () => {
      useCases.create.execute.mockResolvedValue({ id: "new-id" });

      await expect(
        actions.createEvent(null, form({ title: "Semana", date: "2026-02-01", datePrecision: "month" })),
      ).rejects.toThrow("REDIRECT");

      expect(useCases.create.execute).toHaveBeenCalledWith(
        expect.objectContaining({ date: "2026-02-01", datePrecision: "month" }),
      );
    });

    it("rejects an unknown precision with a field error before reaching the use case", async () => {
      const result = await actions.createEvent(null, form({ title: "Semana", date: "2026-02-01", datePrecision: "week" }));

      expect(result).toMatchObject({ fieldErrors: { datePrecision: expect.any(String) } });
      expect(useCases.create.execute).not.toHaveBeenCalled();
    });

    it("returns field errors in Spanish for a domain validation failure and does not redirect", async () => {
      useCases.create.execute.mockRejectedValue(new ValidationError("linkUrl", "linkUrl must be a valid https URL"));

      const result = await actions.createEvent(null, form({ title: "Charla", linkUrl: "http://aso.test" }));

      expect(result.fieldErrors).toEqual({ linkUrl: expect.stringContaining("https://") });
      expect(redirectMock).not.toHaveBeenCalled();
    });

    it("rejects an overlong title before reaching the use case", async () => {
      const result = await actions.createEvent(null, form({ title: "a".repeat(121) }));

      expect(result.fieldErrors?.title).toBeTruthy();
      expect(useCases.create.execute).not.toHaveBeenCalled();
    });

    it("reports an unexpected failure with a generic message and logs it", async () => {
      useCases.create.execute.mockRejectedValue(new Error("db down"));
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

      const result = await actions.createEvent(null, form({ title: "Charla" }));

      expect(result).toEqual({ error: "Ocurrió un error inesperado. Intente nuevamente." });
      expect(log).toHaveBeenCalled();
    });
  });

  describe("updateEvent", () => {
    it("updates by id with the parsed fields and revalidates the list and the edit page", async () => {
      useCases.update.execute.mockResolvedValue({ id: "e1" });

      const result = await actions.updateEvent("e1", null, form({ title: "Nuevo", isPublished: "on" }));

      expect(result).toEqual({ success: true });
      expect(useCases.update.execute).toHaveBeenCalledWith(
        expect.objectContaining({ id: "e1", title: "Nuevo", isPublished: true }),
      );
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/events");
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/events/e1/edit");
    });

    it("passes the registration settings to the use case, and refuses a bad capacity as a field error", async () => {
      useCases.update.execute.mockResolvedValue({ id: "e1" });

      await actions.updateEvent("e1", null, form({ title: "Nuevo", registrationMode: "open", registrationCapacity: "30", registrationDeadline: "2026-11-27T18:00" }));

      expect(useCases.update.execute).toHaveBeenCalledWith(
        expect.objectContaining({ registrationMode: "open", registrationCapacity: 30, registrationDeadline: new Date("2026-11-27T23:00:00.000Z") }),
      );

      useCases.update.execute.mockClear();
      const refused = await actions.updateEvent("e1", null, form({ title: "Nuevo", registrationCapacity: "-1" }));

      expect(refused.fieldErrors).toHaveProperty("registrationCapacity");
      expect(useCases.update.execute).not.toHaveBeenCalled();
    });

    describe("a change that affects the people already registered (D14)", () => {
      const registered = (count: number, current: { registrationMode: string; registrationCapacity: number | null } = { registrationMode: "open", registrationCapacity: 30 }) => {
        useCases.get.execute.mockResolvedValue({ id: "e1", ...current });
        useCases.registeredCount.mockResolvedValue(count);
        useCases.update.execute.mockResolvedValue({ id: "e1" });
      };
      const unchanged = () => {
        expect(useCases.update.execute).not.toHaveBeenCalled();
        expect(revalidatePathMock).not.toHaveBeenCalled();
      };

      it("refuses to change the mode without the confirmation, says how many are registered, and stores nothing", async () => {
        registered(12);

        const result = await actions.updateEvent("e1", null, form({ title: "Nuevo", registrationMode: "unl" }));

        expect(result.success).toBeUndefined();
        expect(result.fieldErrors).toBeUndefined();
        expect(result.error).toMatch(/^Este evento ya tiene 12 inscritos\./);
        expect(result.error).toMatch(/Cuenta UNL/);
        expect(result.error).toMatch(/Confirme el cambio para guardarlo\.$/);
        unchanged();
      });

      it("refuses to lower the seats below the registered people without the confirmation", async () => {
        registered(12);

        const result = await actions.updateEvent("e1", null, form({ title: "Nuevo", registrationMode: "open", registrationCapacity: "11" }));

        expect(result.error).toMatch(/^Este evento ya tiene 12 inscritos\./);
        expect(result.error).toMatch(/11 cupos/);
        expect(result.error).toMatch(/agotado/);
        unchanged();
      });

      it("refuses switching registration off without the confirmation", async () => {
        registered(2);

        const result = await actions.updateEvent("e1", null, form({ title: "Nuevo", registrationMode: "none" }));

        expect(result.error).toMatch(/^Este evento ya tiene 2 inscritos\./);
        expect(result.error).toMatch(/Si quita la inscripción/);
        unchanged();
      });

      it("saves the same change when the form carries the confirmation, with every field as sent", async () => {
        registered(12);

        const result = await actions.updateEvent("e1", null, form({ title: "Nuevo", registrationMode: "unl", registrationCapacity: "5", confirmRegistrationChange: "on" }));

        expect(result).toEqual({ success: true });
        expect(useCases.update.execute).toHaveBeenCalledWith(expect.objectContaining({ id: "e1", registrationMode: "unl", registrationCapacity: 5 }));
      });

      it("does not take any other value of the flag as a confirmation", async () => {
        registered(12);

        for (const value of ["", "off", "yes", "1", "ON"]) {
          const result = await actions.updateEvent("e1", null, form({ title: "Nuevo", registrationMode: "unl", confirmRegistrationChange: value }));

          expect(result.error, value).toMatch(/^Este evento ya tiene 12 inscritos\./);
        }

        unchanged();
      });

      it.each([
        ["keeps the same mode and seats", { registrationMode: "open", registrationCapacity: "30" }],
        ["raises the seats", { registrationMode: "open", registrationCapacity: "50" }],
        ["lowers the seats but not below the registered people", { registrationMode: "open", registrationCapacity: "12" }],
        ["lifts the limit", { registrationMode: "open", registrationCapacity: "" }],
        ["sends no registration setting at all", {}],
      ])("saves without asking when it %s", async (_label, fields) => {
        registered(12);

        expect(await actions.updateEvent("e1", null, form({ title: "Nuevo", ...fields }))).toEqual({ success: true });
        expect(useCases.update.execute).toHaveBeenCalledTimes(1);
      });

      it("saves a change of mode or seats without asking while nobody is registered (pending people do not count)", async () => {
        registered(0);

        expect(await actions.updateEvent("e1", null, form({ title: "Nuevo", registrationMode: "unl", registrationCapacity: "1" }))).toEqual({ success: true });
        expect(useCases.update.execute).toHaveBeenCalledTimes(1);
      });

      it("asks the repository for the confirmed registrations of this event only, and only when a registration setting was sent", async () => {
        registered(3);

        await actions.updateEvent("e1", null, form({ title: "Solo título" }));

        expect(useCases.registeredCount).not.toHaveBeenCalled();

        await actions.updateEvent("e1", null, form({ title: "Con modo", registrationMode: "open" }));

        expect(useCases.registeredCount).toHaveBeenCalledWith("e1");
      });

      it("answers a field error, not the confirmation question, for an invalid capacity, and a missing event as not found", async () => {
        registered(12);

        const invalid = await actions.updateEvent("e1", null, form({ title: "Nuevo", registrationCapacity: "-1" }));

        expect(invalid.fieldErrors).toHaveProperty("registrationCapacity");
        expect(invalid.error).toBeUndefined();

        useCases.get.execute.mockRejectedValue(new NotFoundError("Event not found"));

        expect(await actions.updateEvent("gone", null, form({ title: "x", registrationMode: "open" }))).toEqual({ error: "No se encontró el evento o la foto." });
        unchanged();
      });
    });

    it("maps NotFoundError to a Spanish message", async () => {
      useCases.update.execute.mockRejectedValue(new NotFoundError("Event not found"));

      expect(await actions.updateEvent("gone", null, form({ title: "x" }))).toEqual({
        error: "No se encontró el evento o la foto.",
      });
    });
  });

  describe("setEventPublished / trashEvent", () => {
    it("publishes and unpublishes", async () => {
      useCases.setPublished.execute.mockResolvedValue({});

      expect(await actions.setEventPublished("e1", true)).toEqual({ success: true });
      expect(useCases.setPublished.execute).toHaveBeenCalledWith({ id: "e1", isPublished: true });
      await actions.setEventPublished("e1", false);
      expect(useCases.setPublished.execute).toHaveBeenLastCalledWith({ id: "e1", isPublished: false });
    });

    it("moves to the trash and revalidates the list and the trash", async () => {
      useCases.trash.execute.mockResolvedValue({ wasPublished: false });

      expect(await actions.trashEvent("e1")).toEqual({ success: true });
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/events");
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/papelera");
    });
  });

  describe("photo actions", () => {
    it("uploads a JPEG with its alt text", async () => {
      useCases.attachPhoto.execute.mockResolvedValue({ id: "p1" });
      const file = jpeg();

      expect(await actions.uploadEventPhoto("e1", null, photoForm(file))).toEqual({ success: true });

      expect(useCases.attachPhoto.execute).toHaveBeenCalledWith({
        eventId: "e1",
        file: expect.objectContaining({ name: "a.jpg", type: "image/jpeg" }),
        alt: "Equipo en el hackatón",
      });
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/events/e1/edit");
    });

    it("hands over an empty alt when none was typed, on upload and on edit, so the use case can explain the rule", async () => {
      useCases.attachPhoto.execute.mockResolvedValue({ id: "p1" });
      useCases.updatePhotoAlt.execute.mockResolvedValue({ id: "p1" });

      const fileOnly = new FormData();
      fileOnly.set("file", jpeg());

      expect(await actions.uploadEventPhoto("e1", null, fileOnly)).toEqual({ success: true });
      expect(await actions.updateEventPhotoAlt("e1", "p1", null, form({}))).toEqual({ success: true });

      expect(useCases.attachPhoto.execute).toHaveBeenCalledWith({ eventId: "e1", file: expect.objectContaining({ name: "a.jpg" }), alt: "" });
      expect(useCases.updatePhotoAlt.execute).toHaveBeenCalledWith({ eventId: "e1", photoId: "p1", alt: "" });
    });

    it("rejects a missing file, a wrong type and a spoofed signature before any upload", async () => {
      const noFile = await actions.uploadEventPhoto("e1", null, form({ alt: "Foto" }));
      const gif = await actions.uploadEventPhoto("e1", null, photoForm(new File([new Uint8Array(8)], "a.gif", { type: "image/gif" })));
      const spoofed = await actions.uploadEventPhoto("e1", null, photoForm(new File([new Uint8Array(16)], "a.jpg", { type: "image/jpeg" })));

      for (const result of [noFile, gif, spoofed]) {
        expect(result.fieldErrors?.file).toContain("JPEG, PNG o WebP");
      }
      expect(useCases.attachPhoto.execute).not.toHaveBeenCalled();
    });

    it("explains the 1200 px minimum when the image is too small", async () => {
      useCases.attachPhoto.execute.mockRejectedValue(new ImageTooSmallError(1200, 576));

      const result = await actions.uploadEventPhoto("e1", null, photoForm(jpeg()));

      expect(result.fieldErrors?.file).toContain("1200");
      expect(result.fieldErrors?.file).toContain("576");
    });

    it("tells the owner when the gallery is full", async () => {
      useCases.attachPhoto.execute.mockRejectedValue(new ValidationError("photos", "full"));

      const result = await actions.uploadEventPhoto("e1", null, photoForm(jpeg()));

      expect(result.fieldErrors?.photos).toContain("12");
    });

    it("updates alt text, moves and deactivates", async () => {
      useCases.updatePhotoAlt.execute.mockResolvedValue({});
      useCases.reorderPhotos.execute.mockResolvedValue(undefined);
      useCases.deactivatePhoto.execute.mockResolvedValue(undefined);

      expect(await actions.updateEventPhotoAlt("e1", "p1", null, form({ alt: "Nueva" }))).toEqual({ success: true });
      expect(useCases.updatePhotoAlt.execute).toHaveBeenCalledWith({ eventId: "e1", photoId: "p1", alt: "Nueva" });

      expect(await actions.moveEventPhoto("e1", "p1", "down")).toEqual({ success: true });
      expect(useCases.reorderPhotos.execute).toHaveBeenCalledWith({ eventId: "e1", photoId: "p1", direction: "down" });

      expect(await actions.deactivateEventPhoto("e1", "p1")).toEqual({ success: true });
      expect(useCases.deactivatePhoto.execute).toHaveBeenCalledWith({ eventId: "e1", photoId: "p1" });
    });

    it("ignores an unknown move direction", async () => {
      const result = await actions.moveEventPhoto("e1", "p1", "sideways" as "up");

      expect(result.error).toBeTruthy();
      expect(useCases.reorderPhotos.execute).not.toHaveBeenCalled();
    });

    it("returns the alt field error for an empty description", async () => {
      useCases.updatePhotoAlt.execute.mockRejectedValue(new ValidationError("alt", "alt is required"));

      const result = await actions.updateEventPhotoAlt("e1", "p1", null, form({ alt: " " }));

      expect(result.fieldErrors?.alt).toBeTruthy();
    });
  });
});
