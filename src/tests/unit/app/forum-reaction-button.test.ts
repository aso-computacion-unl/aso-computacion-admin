// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toggleMock, toggleThreadMock } = vi.hoisted(() => ({ toggleMock: vi.fn(), toggleThreadMock: vi.fn() }));

vi.mock("@/interface/forum/forum-helpful", () => ({ toggleForumReplyReaction: toggleMock, toggleForumThreadReaction: toggleThreadMock }));

import { ReactionButton } from "../../../../app/foro/_components/reaction-button";
import { click, mount, settle, unmountAll } from "@/tests/support/dom";

const button = (host: HTMLElement) => host.querySelector<HTMLButtonElement>("button")!;
const mountButton = (props: { count: number; mine: boolean } = { count: 2, mine: false }) => mount(createElement(ReactionButton, { target: { kind: "reply", id: "r1" }, ...props }));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await unmountAll();
});

describe("the «me sirvió» button", () => {
  it("shows the count and whether the viewer already left one, as a toggle", async () => {
    const off = await mountButton({ count: 2, mine: false });
    expect(button(off).textContent).toContain("Me sirvió");
    expect(button(off).textContent).toContain("2");
    expect(button(off).getAttribute("aria-pressed")).toBe("false");

    const on = await mountButton({ count: 3, mine: true });
    expect(on.querySelector("button")!.getAttribute("aria-pressed")).toBe("true");
  });

  it("asks the server for this reply and shows the state and count it answers", async () => {
    toggleMock.mockResolvedValue({ success: true, reacted: true, count: 3 });
    const host = await mountButton();

    await click(button(host));
    await settle();

    expect(toggleMock).toHaveBeenCalledWith("r1");
    expect(button(host).getAttribute("aria-pressed")).toBe("true");
    expect(button(host).textContent).toContain("3");
  });

  it("on the opening post asks the server for the thread, not a reply (D2)", async () => {
    toggleThreadMock.mockResolvedValue({ success: true, reacted: true, count: 1 });
    const host = await mount(createElement(ReactionButton, { target: { kind: "thread", id: "t1" }, count: 0, mine: false }));

    await click(button(host));
    await settle();

    expect(toggleThreadMock).toHaveBeenCalledWith("t1");
    expect(toggleMock).not.toHaveBeenCalled();
    expect(button(host).getAttribute("aria-pressed")).toBe("true");
    expect(button(host).textContent).toContain("1");
  });

  it("takes the reaction back on the second click", async () => {
    toggleMock.mockResolvedValueOnce({ success: true, reacted: true, count: 3 }).mockResolvedValueOnce({ success: true, reacted: false, count: 2 });
    const host = await mountButton();

    await click(button(host));
    await settle();
    await click(button(host));
    await settle();

    expect(button(host).getAttribute("aria-pressed")).toBe("false");
    expect(button(host).textContent).toContain("2");
  });

  it("goes back to the previous state and says why when the server refuses (a suspended account, say)", async () => {
    toggleMock.mockResolvedValue({ error: "Su cuenta no puede participar en el foro." });
    const host = await mountButton();

    await click(button(host));
    await settle();

    expect(button(host).getAttribute("aria-pressed")).toBe("false");
    expect(button(host).textContent).toContain("2");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Su cuenta no puede participar en el foro.");
  });

  it("reports a call that rejects instead of unmounting", async () => {
    toggleMock.mockRejectedValue(new Error("network"));
    const host = await mountButton();

    await click(button(host));
    await settle();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Ocurrió un error inesperado");
    expect(button(host).getAttribute("aria-pressed")).toBe("false");
  });
});
