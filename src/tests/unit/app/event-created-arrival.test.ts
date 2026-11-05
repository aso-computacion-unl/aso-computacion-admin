// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/admin/events/e1/edit",
}));

import { MediaDropzone } from "../../../../app/admin/_components/media-dropzone";
import { ToastProvider } from "../../../../app/admin/_components/toast";
import { EventCreatedArrival } from "../../../../app/admin/events/_components/event-created-arrival";
import { mount, unmountAll } from "@/tests/support/dom";

beforeEach(() => {
  replaceMock.mockReset();
});

afterEach(async () => {
  await unmountAll();
});

/** The edit page in miniature: the arrival next to the Photos section with its real drop zone. */
const page = () =>
  createElement(
    ToastProvider,
    null,
    createElement(EventCreatedArrival),
    createElement(
      "div",
      { id: "fotos" },
      createElement(MediaDropzone, { title: "Elegir fotos", rules: "JPEG", accept: ["image/jpeg"], ariaLabel: "Elegir fotos para subir", onFiles: () => undefined }),
    ),
  );

const toastsIn = (host: HTMLElement) => [...host.querySelectorAll('[role="status"][aria-live="polite"] li')].map((item) => item.textContent);

describe("EventCreatedArrival", () => {
  it("confirms the creation with a toast that tells the person what to do next", async () => {
    const host = await mount(page());

    // The toast reads its message, then the hidden label of its close button.
    expect(toastsIn(host)).toEqual(["Evento creado. Agregue las fotos.Cerrar aviso"]);
  });

  it("moves focus to the photo drop zone", async () => {
    const host = await mount(page());

    expect(document.activeElement).toBe(host.querySelector('#fotos input[type="file"]'));
  });

  it("drops the flag from the URL, keeping the Photos hash and the scroll position, so a reload shows no toast", async () => {
    await mount(page());

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/admin/events/e1/edit#fotos", { scroll: false });
  });

  it("announces the arrival once, also when it renders again", async () => {
    const host = await mount(page());
    await mount(page());

    expect(toastsIn(host)).toHaveLength(1);
    expect(replaceMock).toHaveBeenCalledTimes(2);
  });
});
