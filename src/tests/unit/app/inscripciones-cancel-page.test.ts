import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { pageMock, routerMock } = vi.hoisted(() => ({ pageMock: vi.fn(), routerMock: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() } }));

vi.mock("server-only", () => ({}));
vi.mock("@/interface/event-registration/cancel-registration-read", () => ({ getCancelRegistrationPage: pageMock }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => routerMock,
}));

import { sealRegistrationCancelToken } from "@/infrastructure/registration/registration-cancel-token";
import { sealRegistrationConfirmToken } from "@/infrastructure/registration/registration-confirm-token";

import CancelRegistrationPage, { metadata } from "../../../../app/inscripciones/[slug]/cancelar/page";

/*
 * D7: where the cancellation link of the emails lands. Opening it only shows the event and a button: nothing is
 * cancelled by the GET, because mail scanners and link previews open every link.
 */
const event = { slug: "taller-docker", title: "Taller de Docker", description: null, date: "2099-11-20", datePrecision: "day" as const, hora: "15:00", lugar: "Laboratorio 2" };
const registration = (over: Record<string, unknown> = {}) => ({ event, mode: "open", state: "open", alreadyRegistered: false, capacity: 30, registered: 3, deadline: null, ...over });
const page = (over: Record<string, unknown> = {}) => ({ eventId: "e1", closed: over.state === "closed", event, mode: "open", registration: registration(over) });

let fetchMock: ReturnType<typeof vi.fn>;

const render = async (token: string | undefined, slug = "taller-docker") =>
  renderToStaticMarkup(await CancelRegistrationPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(token === undefined ? {} : { token }) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("REGISTRATION_CONFIRM_SECRET", "r".repeat(40));
  pageMock.mockResolvedValue(page());
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("the cancel page (server)", () => {
  it("is private: not indexed, and the token does not leak through the Referer", () => {
    expect(metadata).toMatchObject({ robots: { index: false }, referrer: "no-referrer" });
  });

  it("shows the event's ticket and a Cancelar mi inscripción button for a good link, and cancels nothing by merely being opened", async () => {
    const token = await sealRegistrationCancelToken({ registrationId: "r1", eventId: "e1" });
    const html = await render(token);

    expect(html).toContain("Taller de Docker");
    expect(html).toContain("Cancelar mi inscripción");
    expect(html).toContain("<button");
    expect(html).not.toContain("quedó cancelada");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("works for an event that no longer takes registrations through its mode: the person can still let the seat go", async () => {
    pageMock.mockResolvedValue({ eventId: "e1", closed: false, event, mode: "none", registration: null });

    const html = await render(await sealRegistrationCancelToken({ registrationId: "r1", eventId: "e1" }));

    expect(html).toContain("Cancelar mi inscripción");
  });

  it.each([
    ["a missing token", undefined],
    ["garbage", "not-a-token"],
  ])("says the link is no use, without a button, for %s", async (_label, token) => {
    const html = await render(token);

    expect(html).toContain("Este enlace no sirve");
    expect(html).not.toContain("Cancelar mi inscripción");
  });

  it("does not take a confirmation link as a cancellation link", async () => {
    const html = await render(await sealRegistrationConfirmToken({ registrationId: "r1", eventId: "e1" }));

    expect(html).toContain("Este enlace no sirve");
    expect(html).not.toContain("Cancelar mi inscripción");
  });

  it("says the link expired, without a button, once its year is over", async () => {
    const html = await render(await sealRegistrationCancelToken({ registrationId: "r1", eventId: "e1" }, new Date(Date.now() - 366 * 24 * 3_600_000)));

    expect(html).toContain("Este enlace venció");
    expect(html).toContain("directiva de ASO");
    expect(html).not.toContain("Cancelar mi inscripción");
  });

  it("says registration closed instead of offering a button that can only be refused", async () => {
    pageMock.mockResolvedValue(page({ state: "closed" }));

    const html = await render(await sealRegistrationCancelToken({ registrationId: "r1", eventId: "e1" }));

    expect(html).toContain("Las inscripciones de este evento ya cerraron");
    expect(html).toContain("directiva de ASO");
    expect(html).not.toContain("Cancelar mi inscripción");
  });

  it("S4: says the link is no use, without a button, for a link of another event (the POST would refuse it)", async () => {
    const html = await render(await sealRegistrationCancelToken({ registrationId: "r1", eventId: "another-event" }));

    expect(html).toContain("Este enlace no sirve");
    expect(html).not.toContain("Cancelar mi inscripción");
  });

  it("S4: says registration closed, without a button, for a closed event that no longer takes registrations through its mode", async () => {
    pageMock.mockResolvedValue({ eventId: "e1", closed: true, event, mode: "none", registration: null });

    const html = await render(await sealRegistrationCancelToken({ registrationId: "r1", eventId: "e1" }));

    expect(html).toContain("Las inscripciones de este evento ya cerraron");
    expect(html).not.toContain("Cancelar mi inscripción");
  });

  it("S3: says the service is unavailable, without a button, while the link secret is not usable (the link is not the problem)", async () => {
    vi.stubEnv("REGISTRATION_CONFIRM_SECRET", "");

    const html = await render("any-token");

    expect(html).toContain("El servicio no está disponible en este momento");
    expect(html).not.toContain("Este enlace no sirve");
    expect(html).not.toContain("Cancelar mi inscripción");
  });

  it("keeps the button for a full event: letting a seat go is exactly what it is for", async () => {
    pageMock.mockResolvedValue(page({ state: "full" }));

    expect(await render(await sealRegistrationCancelToken({ registrationId: "r1", eventId: "e1" }))).toContain("Cancelar mi inscripción");
  });

  describe("an event that is not public (unknown, draft, withdrawn or in the trash)", () => {
    it("says so for a link that is ours, instead of a 404, with no button", async () => {
      pageMock.mockResolvedValue(null);

      const html = await render(await sealRegistrationCancelToken({ registrationId: "r1", eventId: "e1" }));

      expect(html).toContain("Este evento ya no está disponible");
      expect(html).toContain('href="/inscripciones"');
      expect(html).not.toContain("Cancelar mi inscripción");
    });

    it("stays a 404 with a bad token: nothing there says the event ever existed", async () => {
      pageMock.mockResolvedValue(null);

      await expect(render("not-a-token")).rejects.toThrow("NEXT_NOT_FOUND");
      await expect(render(undefined)).rejects.toThrow("NEXT_NOT_FOUND");
    });
  });
});
