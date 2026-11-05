// @vitest-environment jsdom
import { createElement } from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SectionJumps } from "../../../../app/admin/_components/section-jumps";
import { click, mount, unmountAll } from "@/tests/support/dom";

// jsdom has no layout: each section reports the top the test gives it, and the page is taller than the viewport.
const tops: Record<string, number> = { datos: 80, fotos: 2900 };

beforeEach(() => {
  Object.defineProperty(document.documentElement, "scrollHeight", { value: 6000, configurable: true });
  for (const id of Object.keys(tops)) {
    const section = document.createElement("section");
    section.id = id;
    // Read on every call, so a test can "scroll" by changing `tops`.
    section.getBoundingClientRect = () => ({ top: tops[id] }) as DOMRect;
    document.body.append(section);
  }
});

afterEach(async () => {
  await unmountAll();
  document.getElementById("datos")?.remove();
  document.getElementById("fotos")?.remove();
  vi.restoreAllMocks();
});

const items = [
  { href: "#datos", label: "Datos" },
  { href: "#fotos", label: "Fotos (0)" },
] as const;
const chips = (host: HTMLElement) => [...host.querySelectorAll("a")];
const current = (host: HTMLElement) => chips(host).filter((chip) => chip.getAttribute("aria-current") === "location").map((chip) => chip.textContent);
const scrollTo = async (patch: Record<string, number>) => {
  Object.assign(tops, patch);
  await act(async () => {
    window.dispatchEvent(new Event("scroll"));
  });
};

describe("SectionJumps current section", () => {
  it("marks the section in view (aria-current) and nothing else", async () => {
    tops.datos = 80;
    tops.fotos = 2900;
    const host = await mount(createElement(SectionJumps, { label: "Secciones", items }));

    expect(current(host)).toEqual(["Datos"]);
  });

  it("marks the chip that was just tapped, then follows the scroll", async () => {
    tops.datos = 80;
    tops.fotos = 2900;
    const host = await mount(createElement(SectionJumps, { label: "Secciones", items }));

    await click(chips(host)[1]!);
    expect(current(host)).toEqual(["Fotos (0)"]);

    await scrollTo({ datos: -2820, fotos: 80 });
    expect(current(host)).toEqual(["Fotos (0)"]);

    await scrollTo({ datos: 80, fotos: 2900 });
    expect(current(host)).toEqual(["Datos"]);
  });

  it("starts on the Photos section when the page opens scrolled there", async () => {
    tops.datos = -2820;
    tops.fotos = 80;
    const host = await mount(createElement(SectionJumps, { label: "Secciones", items }));

    expect(current(host)).toEqual(["Fotos (0)"]);
  });
});
