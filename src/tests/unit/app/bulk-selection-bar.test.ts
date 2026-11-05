// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/interface/admin/bulk/actions", () => ({ bulkSetPublished: vi.fn(), bulkTrash: vi.fn() }));

import { BulkCheckbox, BulkSelection } from "../../../../app/admin/_components/bulk-selection";
import { click, mount, unmountAll } from "@/tests/support/dom";

const ITEMS = [
  { id: "a", label: "Taller de Git" },
  { id: "b", label: "Charla de Docker" },
];

const mountList = () =>
  mount(
    createElement(
      BulkSelection,
      { kind: "event", items: ITEMS },
      createElement("ul", null, ITEMS.map((item) => createElement("li", { key: item.id }, createElement(BulkCheckbox, item)))),
    ),
  );

const row = (host: HTMLElement, label: string) => host.querySelector<HTMLInputElement>(`input[aria-label="Seleccionar: ${label}"]`)!;
const bar = (host: HTMLElement) => host.querySelector<HTMLElement>('section[aria-label="Acciones en lote"]');

afterEach(async () => {
  await unmountAll();
});

describe("the selection bar", () => {
  it("is absent until a row is selected", async () => {
    const host = await mountList();

    expect(bar(host)).toBeNull();
    expect(host.textContent).not.toContain("Nada seleccionado");
  });

  it("appears with the count and the actions once a row is selected, and goes away when it is cleared", async () => {
    const host = await mountList();

    await click(row(host, "Taller de Git"));

    expect(bar(host)?.textContent).toContain("1 seleccionado");
    expect(bar(host)?.textContent).toContain("Seleccionar todo en esta página");
    expect(bar(host)?.textContent).toContain("Mover a la papelera");

    await click(row(host, "Taller de Git"));

    expect(bar(host)).toBeNull();
  });

  it("selects every row from the bar", async () => {
    const host = await mountList();

    await click(row(host, "Taller de Git"));
    await click(bar(host)!.querySelector<HTMLInputElement>('input[type="checkbox"]')!);

    expect(bar(host)?.textContent).toContain("2 seleccionados");
    expect(row(host, "Charla de Docker").checked).toBe(true);
  });

  it("sticks to the bottom, after the rows, so selecting a row never moves the rows under the pointer", async () => {
    const host = await mountList();

    await click(row(host, "Taller de Git"));

    const section = bar(host)!;

    expect(section.className).toContain("sticky");
    expect(section.className).toMatch(/bottom-/);
    expect(host.querySelector("ul")!.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  describe("focus when the bar hides", () => {
    const master = (host: HTMLElement) => bar(host)!.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    const clear = (host: HTMLElement) => [...bar(host)!.querySelectorAll("button")].find((button) => button.textContent === "Limpiar selección")!;
    const focus = (element: HTMLElement) => act(async () => element.focus());

    it("moves to the first row checkbox when «Limpiar selección» had focus", async () => {
      const host = await mountList();

      await click(row(host, "Charla de Docker"));
      await focus(clear(host));
      await click(clear(host));

      expect(bar(host)).toBeNull();
      expect(document.activeElement).toBe(row(host, "Taller de Git"));
    });

    it("moves to the first row checkbox when the select-all box had focus and deselects everything", async () => {
      const host = await mountList();

      await click(row(host, "Taller de Git"));
      await click(master(host));
      await focus(master(host));
      await click(master(host));

      expect(bar(host)).toBeNull();
      expect(document.activeElement).toBe(row(host, "Taller de Git"));
    });

    it("leaves focus alone when the bar stays visible", async () => {
      const host = await mountList();

      await click(row(host, "Taller de Git"));
      await focus(master(host));
      await click(master(host));

      expect(bar(host)).not.toBeNull();
      expect(document.activeElement).toBe(master(host));
    });

    it("leaves focus alone when it was outside the bar", async () => {
      const host = await mountList();

      await click(row(host, "Charla de Docker"));
      await focus(row(host, "Charla de Docker"));
      await click(clear(host));

      expect(bar(host)).toBeNull();
      expect(document.activeElement).toBe(row(host, "Charla de Docker"));
    });
  });
});
