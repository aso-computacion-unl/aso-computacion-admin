// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/interface/admin/news/actions", () => ({ uploadNewsCover: vi.fn(), removeNewsCover: vi.fn() }));
vi.mock("@/interface/admin/board/actions", () => ({ uploadBoardMemberPhoto: vi.fn(), removeBoardMemberPhoto: vi.fn() }));
vi.mock("@/interface/admin/pillars/actions", () => ({ uploadPillarImage: vi.fn(), removePillarImage: vi.fn() }));
vi.mock("@/interface/admin/sponsors/actions", () => ({ uploadSponsorLogo: vi.fn(), removeSponsorLogo: vi.fn() }));
vi.mock("@/interface/admin/events/actions", () => ({ uploadEventPhoto: vi.fn(), deleteEventPhoto: vi.fn(), setEventPhotoAlt: vi.fn(), moveEventPhoto: vi.fn() }));

import { MediaDropzone } from "../../../../app/admin/_components/media-dropzone";
import { BoardMemberPhotoPanel } from "../../../../app/admin/board/_components/board-member-photo-panel";
import { PhotoUploadForm } from "../../../../app/admin/events/_components/photo-upload-form";
import { NewsCoverPanel } from "../../../../app/admin/news/_components/news-cover-panel";
import { PillarImagePanel } from "../../../../app/admin/pillars/_components/pillar-image-panel";
import { SponsorLogoPanel } from "../../../../app/admin/sponsors/_components/sponsor-logo-panel";
import { mount, unmountAll } from "@/tests/support/dom";

afterEach(async () => {
  await unmountAll();
});

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

describe("MediaDropzone", () => {
  const render = (props: Partial<Parameters<typeof MediaDropzone>[0]> = {}) =>
    renderToStaticMarkup(createElement(MediaDropzone, { title: "Elegir foto", rules: "JPEG, PNG o WebP · hasta 5 MB", accept: ACCEPT, ariaLabel: "Elegir foto", onFiles: () => undefined, ...props }));

  it("shows the title, the drag hint and the rules in one dashed drop zone", () => {
    const html = render();

    expect(html).toContain('data-slot="media-dropzone"');
    expect(html).toContain("Elegir foto");
    expect(html).toContain("o arrastrarla aquí");
    expect(html).toContain("JPEG, PNG o WebP · hasta 5 MB");
    expect(html).toContain("border-dashed");
  });

  it("speaks in the plural when it takes several files", () => {
    expect(render({ multiple: true })).toContain("o arrastrarlas aquí");
    expect(render({ multiple: true })).toContain("multiple");
  });

  it("restricts the picker to the accepted types and can be switched off", () => {
    const html = render({ disabled: true });

    expect(html).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(html).toContain("disabled");
  });

  it("names the file already picked in place of the title", () => {
    const html = render({ chosen: { name: "portada.jpg", size: "1.2 MB" } });

    expect(html).toContain("portada.jpg");
    expect(html).toContain("1.2 MB");
  });

  it("hands the picked files to its owner as an array", async () => {
    const onFiles = vi.fn();
    const host = await mount(createElement(MediaDropzone, { title: "Elegir foto", rules: "r", accept: ACCEPT, ariaLabel: "Elegir foto", onFiles }));
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(["x"], "a.png", { type: "image/png" });

    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onFiles).toHaveBeenCalledWith([file]);
  });
});

describe("every upload screen uses the shared drop zone", () => {
  const image = { url: "https://res.cloudinary.com/demo/image/upload/a.jpg", width: 800, height: 600, alt: "Una foto" };
  const panels = [
    ["news cover", createElement(NewsCoverPanel, { newsId: "n", cover: null }), "Elegir foto de portada"],
    ["board member", createElement(BoardMemberPhotoPanel, { memberId: "m", photo: null }), "Elegir foto"],
    ["pillar", createElement(PillarImagePanel, { pillarId: "p", image: null }), "Elegir imagen"],
    ["sponsor", createElement(SponsorLogoPanel, { sponsorId: "s", logo: null }), "Elegir logo"],
    ["news cover (replace)", createElement(NewsCoverPanel, { newsId: "n", cover: image }), "Elegir otra foto de portada"],
  ] as const;

  it.each(panels)("%s", (_name, element, title) => {
    const html = renderToStaticMarkup(element);

    expect(html).toContain('data-slot="media-dropzone"');
    expect(html).toContain(title);
    expect(html).toContain("o arrastrarla aquí");
  });

  it("keeps the event photos on the same component", () => {
    const html = renderToStaticMarkup(createElement(PhotoUploadForm, { eventId: "e", activeCount: 0, minWidth: 1200 }));

    expect(html).toContain('data-slot="media-dropzone"');
    expect(html).toContain("Elegir fotos");
    expect(html).toContain("o arrastrarlas aquí");
  });

  it("sizes the picked-photo cards by the panel width, not the window width", async () => {
    Object.assign(URL, { createObjectURL: () => "blob:preview", revokeObjectURL: () => undefined });
    const host = await mount(createElement(PhotoUploadForm, { eventId: "e", activeCount: 0, minWidth: 1200 }));
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;

    Object.defineProperty(input, "files", { value: [new File(["x"], "foto.jpg", { type: "image/jpeg" })], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const list = host.querySelector('ul[aria-label="Fotos por subir"]')!;
    const card = list.querySelector("li")!;
    const viewportBreakpoint = /(^|\s)(sm|md|lg|xl|2xl):/;

    expect(list.closest(".\\@container")).not.toBeNull();
    expect(list.className).not.toMatch(viewportBreakpoint);
    expect(card.className).not.toMatch(viewportBreakpoint);
    expect(card.textContent).toContain("Descripción");
  });
});

describe("a single-image panel", () => {
  it("offers no upload button, and asks for no description, until a file is picked", async () => {
    const host = await mount(createElement(NewsCoverPanel, { newsId: "n", cover: null }));

    expect(host.querySelector('button[type="submit"]')).toBeNull();
    expect(host.textContent).not.toContain("Descripción de la foto nueva");
  });

  it("then shows the file, the description it needs and one upload button", async () => {
    const host = await mount(createElement(NewsCoverPanel, { newsId: "n", cover: null }));
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(["x"], "portada.jpg", { type: "image/jpeg" });

    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(host.textContent).toContain("portada.jpg");
    expect(host.textContent).toContain("Descripción de la foto nueva");
    expect(host.querySelectorAll('button[type="submit"]')).toHaveLength(1);
    expect(host.querySelector('button[type="submit"]')?.textContent).toContain("Subir portada");
  });
});
