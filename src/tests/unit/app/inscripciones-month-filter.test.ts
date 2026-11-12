// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { RegistrationMonths } from "../../../../app/inscripciones/_components/registration-months";
import { click, mount, unmountAll } from "@/tests/support/dom";

afterEach(async () => {
  await unmountAll();
});

const group = (key: string, heading: string, ofMonth: string | null, count: number) => ({
  key,
  heading,
  name: ofMonth === null ? null : heading,
  ofMonth,
  count,
  rows: createElement("ul", null, createElement("li", null, `filas de ${heading}`)),
});

const groups = [group("2099-11", "Noviembre", "noviembre", 4), group("2099-12", "Diciembre", "diciembre", 1), group("undated", "Fecha por definir", null, 1)];

const visibleHeadings = (host: HTMLElement) => [...host.querySelectorAll("section:not([hidden]) h2")].map((heading) => heading.textContent);
const stub = (host: HTMLElement, name: string) => [...host.querySelectorAll<HTMLButtonElement>("nav button")].find((button) => button.textContent?.startsWith(name))!;

describe("S4: pressing a month's stub", () => {
  it("shows only that month's events, presses that stub alone and says what is shown", async () => {
    const host = await mount(createElement(RegistrationMonths, { total: 6, groups }));

    expect(visibleHeadings(host)).toEqual(["Noviembre", "Diciembre", "Fecha por definir"]);

    await click(stub(host, "Noviembre"));

    expect(visibleHeadings(host)).toEqual(["Noviembre"]);
    expect(stub(host, "Noviembre").getAttribute("aria-pressed")).toBe("true");
    expect(stub(host, "Todos").getAttribute("aria-pressed")).toBe("false");
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Mostrando 4 eventos de noviembre");

    await click(stub(host, "Diciembre"));

    expect(visibleHeadings(host)).toEqual(["Diciembre"]);
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Mostrando 1 evento de diciembre");

    await click(stub(host, "Todos"));

    expect(visibleHeadings(host)).toEqual(["Noviembre", "Diciembre", "Fecha por definir"]);
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Mostrando los 6 eventos");
  });

  it("has no stub for the undated events: only Todos shows them", async () => {
    const host = await mount(createElement(RegistrationMonths, { total: 6, groups }));

    expect([...host.querySelectorAll("nav button")].map((button) => button.textContent)).toEqual(["Todos6 eventos", "Noviembre4 eventos", "Diciembre1 evento"]);
  });

  it("shows the headings and no filter when the events fall in a single month", async () => {
    const host = await mount(createElement(RegistrationMonths, { total: 4, groups: [group("2099-11", "Noviembre", "noviembre", 4)] }));

    expect(host.querySelector("nav")).toBeNull();
    expect(host.querySelector('[role="status"]')).toBeNull();
    expect(visibleHeadings(host)).toEqual(["Noviembre"]);
  });
});
