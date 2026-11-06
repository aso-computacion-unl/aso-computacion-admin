// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IdentityChip } from "../../../../app/_components/identity-chip";
import { ToastProvider, useToast } from "../../../../app/admin/_components/toast";
import { click, mount, unmountAll } from "@/tests/support/dom";

function Notifier() {
  const { notify } = useToast();

  return createElement("button", { type: "button", id: "notify", onClick: () => notify("Guardado.") }, "notificar");
}

const mountPage = () =>
  mount(createElement(ToastProvider, null, createElement(IdentityChip, { name: "Ana Pérez", roleLabel: "Administrador", signOut: null }), createElement(Notifier)));
const elapse = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));
const chip = (host: HTMLElement) => host.querySelector<HTMLElement>("[aria-haspopup]")!;
const shown = () => document.body.textContent?.includes("Guardado.");

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(async () => {
  await unmountAll();
  vi.useRealTimers();
});

describe("a toast while the identity menu is open", () => {
  it("is not dismissed while the menu is open, so the menu cannot hide it until it expires", async () => {
    const host = await mountPage();

    await click(host.querySelector("#notify")!);
    await click(chip(host));
    await elapse(20_000);

    expect(shown()).toBe(true);
  });

  it("goes on with the time it had left once the menu closes", async () => {
    const host = await mountPage();

    await click(host.querySelector("#notify")!);
    await elapse(3000);
    await click(chip(host));
    await elapse(20_000);
    await click(chip(host));
    await elapse(1900);

    expect(shown()).toBe(true);

    await elapse(200);

    expect(shown()).toBe(false);
  });

  it("is dismissed on time when the menu was never open", async () => {
    const host = await mountPage();

    await click(host.querySelector("#notify")!);
    await elapse(5100);

    expect(shown()).toBe(false);
  });
});
