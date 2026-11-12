// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { suspendMock } = vi.hoisted(() => ({ suspendMock: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/interface/admin/forum/moderation-actions", () => ({ setForumMemberSuspended: suspendMock }));

import { ReactivateButton } from "../../../../app/admin/foro/miembros/_components/reactivate-button";
import { ToastProvider } from "../../../../app/admin/_components/toast";
import { click, mount, settle, unmountAll } from "@/tests/support/dom";

const mountButton = () => mount(createElement(ToastProvider, null, createElement(ReactivateButton, { memberId: "m1", name: "Cristina" })));
const button = (host: HTMLElement) => host.querySelector("button")!;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await unmountAll();
});

describe("ReactivateButton", () => {
  it("reactivates the account through the same action as the report queue and says so", async () => {
    suspendMock.mockResolvedValue({ success: true });
    const host = await mountButton();

    expect(button(host).getAttribute("aria-label")).toBe("Reactivar la cuenta: Cristina");

    await click(button(host));
    await settle();

    expect(suspendMock).toHaveBeenCalledWith("m1", false);
    expect(document.body.textContent).toContain("Cuenta reactivada.");
  });

  it("says nothing changed when another moderator got there first", async () => {
    suspendMock.mockResolvedValue({ success: true, unchanged: true });
    const host = await mountButton();

    await click(button(host));
    await settle();

    expect(document.body.textContent).toContain("Sin cambios: otra persona ya lo había hecho.");
    expect(document.body.textContent).not.toContain("Cuenta reactivada.");
  });

  it("shows the error the action answers, next to the button", async () => {
    suspendMock.mockResolvedValue({ error: "No se encontró la publicación, el reporte o la cuenta. Puede que ya no exista." });
    const host = await mountButton();

    await click(button(host));
    await settle();

    expect(host.textContent).toContain("No se encontró la publicación, el reporte o la cuenta. Puede que ya no exista.");
  });

  it("does not fire twice while the first call is pending", async () => {
    let finish: (value: { success: true }) => void = () => undefined;
    suspendMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const host = await mountButton();

    await click(button(host));
    await click(button(host));

    expect(suspendMock).toHaveBeenCalledTimes(1);

    finish({ success: true });
    await settle();
  });
});
