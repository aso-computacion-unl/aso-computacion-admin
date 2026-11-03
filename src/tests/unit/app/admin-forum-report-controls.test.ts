// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { hideMock, lockMock, suspendMock, hideReplyMock, closeMock } = vi.hoisted(() => ({
  hideMock: vi.fn(),
  hideReplyMock: vi.fn(),
  lockMock: vi.fn(),
  suspendMock: vi.fn(),
  closeMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/interface/admin/forum/moderation-actions", () => ({
  setForumThreadHidden: hideMock,
  setForumReplyHidden: hideReplyMock,
  setForumThreadLocked: lockMock,
  setForumMemberSuspended: suspendMock,
  closeForumReport: closeMock,
}));

import { PostControls } from "../../../../app/admin/foro/reportes/_components/report-controls";
import { ToastProvider } from "../../../../app/admin/_components/toast";
import { click, mount, settle, unmountAll } from "@/tests/support/dom";

const target = { kind: "thread", threadId: "t1", replyId: null, threadTitle: "Duda", excerpt: "x", authorId: "m1", authorName: "Ana", authorSuspended: false, hidden: false, locked: false } as const;
const controls = (host: HTMLElement, label: string) => [...host.querySelectorAll("button")].find((button) => button.textContent?.includes(label))!;
const mountControls = () => mount(createElement(ToastProvider, null, createElement(PostControls, { target })));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await unmountAll();
});

describe("the moderation step buttons", () => {
  it("confirm what they did when the step changed something", async () => {
    hideMock.mockResolvedValue({ success: true });
    const host = await mountControls();

    await click(controls(host, "Ocultar el hilo"));
    await settle();

    expect(hideMock).toHaveBeenCalledWith("t1", true);
    expect(document.body.textContent).toContain("Publicación oculta para los estudiantes.");
  });

  it("say nothing changed when the target was already in the wanted state", async () => {
    lockMock.mockResolvedValue({ success: true, unchanged: true });
    const host = await mountControls();

    await click(controls(host, "Cerrar el hilo"));
    await settle();

    expect(document.body.textContent).toContain("Sin cambios: otra persona ya lo había hecho.");
    expect(document.body.textContent).not.toContain("Hilo cerrado");
  });

  it("show the error inline and no toast when the step fails", async () => {
    hideMock.mockResolvedValue({ error: "No se encontró la publicación, el reporte o la cuenta. Puede que ya no exista." });
    const host = await mountControls();

    await click(controls(host, "Ocultar el hilo"));
    await settle();

    expect(host.textContent).toContain("No se encontró la publicación");
    expect(document.body.textContent).not.toContain("Sin cambios");
  });
});
