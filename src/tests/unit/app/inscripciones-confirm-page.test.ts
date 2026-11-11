import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { pageMock, routerMock } = vi.hoisted(() => ({ pageMock: vi.fn(), routerMock: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() } }));

vi.mock("server-only", () => ({}));
vi.mock("@/interface/forum/event-registration-read", () => ({ getEventRegistrationPage: pageMock }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => routerMock,
}));

import { sealRegistrationConfirmToken } from "@/infrastructure/registration/registration-confirm-token";

import ConfirmRegistrationPage, { metadata } from "../../../../app/inscripciones/[slug]/confirmar/page";

const event = { slug: "taller-docker", title: "Taller de Docker", description: null, date: "2099-11-20", datePrecision: "day" as const, hora: "15:00", lugar: "Laboratorio 2" };
const open = (over: Record<string, unknown> = {}) => ({
  kind: "open",
  siteKey: undefined,
  captchaMisconfigured: false,
  calendarHref: "/api/public/events/taller-docker/calendar.ics",
  status: { event, mode: "open", state: "open", alreadyRegistered: false, capacity: 30, registered: 3, deadline: null, ...over },
});
const FORM = "/inscripciones/taller-docker";

let fetchMock: ReturnType<typeof vi.fn>;

const render = async (token: string | undefined, slug = "taller-docker") =>
  renderToStaticMarkup(await ConfirmRegistrationPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(token === undefined ? {} : { token }) }));

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("REGISTRATION_CONFIRM_SECRET", "r".repeat(40));
  pageMock.mockResolvedValue(open());
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("the confirm page (server)", () => {
  it("is private: not indexed, and the token does not leak through the Referer", () => {
    expect(metadata).toMatchObject({ robots: { index: false }, referrer: "no-referrer" });
  });

  it("shows the event's ticket and a Confirmar mi cupo button for a good link, and confirms nothing by merely being opened", async () => {
    const token = await sealRegistrationConfirmToken({ registrationId: "r1", eventId: "e1" });
    const html = await render(token);

    expect(html).toContain("Taller de Docker");
    expect(html).toContain("Confirmar mi cupo");
    expect(html).toContain("<button");
    expect(html).not.toContain("Listo, su cupo");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["a missing token", undefined],
    ["garbage", "not-a-token"],
  ])("says the link is no use, with the way back to the form, for %s", async (_label, token) => {
    const html = await render(token);

    expect(html).toContain("Este enlace no sirve");
    expect(html).toContain(`href="${FORM}"`);
    expect(html).not.toContain("Confirmar mi cupo");
  });

  it("says the link expired, with the way back to the form, once its 48 hours are over", async () => {
    const token = await sealRegistrationConfirmToken({ registrationId: "r1", eventId: "e1" }, new Date(Date.now() - 49 * 3_600_000));
    const html = await render(token);

    expect(html).toContain("Este enlace venció");
    expect(html).toContain(`href="${FORM}"`);
    expect(html).not.toContain("Confirmar mi cupo");
  });

  it("S3: says the service is unavailable, without a button or the way back to the form, while the link secret is not usable", async () => {
    vi.stubEnv("REGISTRATION_CONFIRM_SECRET", "");

    const html = await render("any-token");

    expect(html).toContain("El servicio no está disponible en este momento");
    expect(html).not.toContain("Este enlace no sirve");
    expect(html).not.toContain("Confirmar mi cupo");
  });

  describe("an event that no longer takes open-form registrations (D11)", () => {
    const gone: [string, () => void][] = [
      ["unpublished, trashed or gone", () => pageMock.mockResolvedValue(null)],
      ["switched to no registration", () => pageMock.mockResolvedValue({ kind: "none", event, calendarHref: null })],
      ["switched to UNL accounts", () => pageMock.mockResolvedValue({ kind: "unl", member: null, loginAvailable: true, status: open().status, calendarHref: null, remindersOn: false })],
    ];

    it.each(gone)("says the event no longer takes registrations, instead of a 404, when it was %s", async (_label, arrange) => {
      const token = await sealRegistrationConfirmToken({ registrationId: "r1", eventId: "e1" });

      arrange();

      const html = await render(token);

      expect(html).toContain("Este evento ya no recibe inscripciones");
      expect(html).toContain('href="/inscripciones"');
      expect(html).not.toContain("Confirmar mi cupo");
      expect(html).not.toContain("Este enlace no sirve");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each(gone)("says so for a link older than 48 hours too (it is ours), when the event was %s", async (_label, arrange) => {
      const token = await sealRegistrationConfirmToken({ registrationId: "r1", eventId: "e1" }, new Date(Date.now() - 49 * 3_600_000));

      arrange();

      expect(await render(token)).toContain("Este evento ya no recibe inscripciones");
    });

    it("still says the link is no use for a bad token when the event is public but no longer open, without offering the form", async () => {
      pageMock.mockResolvedValue({ kind: "none", event, calendarHref: null });

      for (const token of [undefined, "not-a-token"]) {
        const html = await render(token);

        expect(html).toContain("Este enlace no sirve");
        expect(html).not.toContain("Este evento ya no recibe inscripciones");
        expect(html).not.toContain("Volver al formulario");
      }
    });

    it("stays a 404 for an unknown event with a bad token: nothing there says the event ever existed", async () => {
      pageMock.mockResolvedValue(null);

      await expect(render("not-a-token")).rejects.toThrow("NEXT_NOT_FOUND");
      await expect(render(undefined)).rejects.toThrow("NEXT_NOT_FOUND");
    });

    it("keeps the confirm button for an event that is still open, even when it is full or closed (the click answers)", async () => {
      const token = await sealRegistrationConfirmToken({ registrationId: "r1", eventId: "e1" });

      pageMock.mockResolvedValue(open({ state: "full" }));

      const html = await render(token);

      expect(html).toContain("Confirmar mi cupo");
      expect(html).not.toContain("Este evento ya no recibe inscripciones");
    });
  });
});
