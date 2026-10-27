// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { bestMock, routerMock } = vi.hoisted(() => ({ bestMock: vi.fn(), routerMock: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() } }));

vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/interface/forum/forum-best-answer", () => ({ setForumBestAnswer: bestMock }));

import { BestAnswerButton } from "../../../../app/foro/_components/best-answer-button";
import { click, mount, settle, unmountAll } from "@/tests/support/dom";

const button = (host: HTMLElement) => host.querySelector<HTMLButtonElement>("button")!;
const mountButton = (isBest: boolean) => mount(createElement(BestAnswerButton, { threadId: "t1", replyId: "r1", isBest }));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await unmountAll();
});

describe("the best answer button", () => {
  it("marks the reply as the best answer and refreshes the thread", async () => {
    bestMock.mockResolvedValue({ success: true, id: "r1" });
    const host = await mountButton(false);

    expect(button(host).textContent).toBe("Marcar como mejor respuesta");
    await click(button(host));
    await settle();

    expect(bestMock).toHaveBeenCalledWith("t1", "r1");
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("takes the mark back from the current best answer", async () => {
    bestMock.mockResolvedValue({ success: true });
    const host = await mountButton(true);

    expect(button(host).textContent).toBe("Quitar de mejor respuesta");
    await click(button(host));
    await settle();

    expect(bestMock).toHaveBeenCalledWith("t1", null);
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("says why when the server refuses (a thread closed in the meantime) and does not refresh", async () => {
    bestMock.mockResolvedValue({ error: "Este hilo está cerrado: no admite respuestas ni cambios." });
    const host = await mountButton(false);

    await click(button(host));
    await settle();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Este hilo está cerrado");
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("reports a call that rejects instead of unmounting", async () => {
    bestMock.mockRejectedValue(new Error("network"));
    const host = await mountButton(false);

    await click(button(host));
    await settle();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Ocurrió un error inesperado");
  });
});
