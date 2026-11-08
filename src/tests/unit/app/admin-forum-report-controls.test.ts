// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

import { Icon } from "@/components/icons";
import { ReportActions } from "../../../../app/admin/foro/reportes/_components/report-controls";
import { ToastProvider } from "../../../../app/admin/_components/toast";
import { click, mount, settle, typeInto, unmountAll } from "@/tests/support/dom";

const thread = { kind: "thread", threadId: "t1", replyId: null, threadTitle: "Duda", excerpt: "x", authorId: "m1", authorName: "Ana", authorSuspended: false, hidden: false, locked: false } as const;
const report = (target: Record<string, unknown> = {}) => ({ id: "p1", target: { ...thread, ...target } }) as Parameters<typeof ReportActions>[0]["report"];
const controls = (host: HTMLElement, label: string) => [...host.querySelectorAll("button")].find((button) => button.textContent?.includes(label))!;
const mountControls = (target: Record<string, unknown> = {}) => mount(createElement(ToastProvider, null, createElement(ReportActions, { report: report(target) })));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await unmountAll();
});

describe("the report actions", () => {
  it("confirm what they did when the step changed something", async () => {
    hideMock.mockResolvedValue({ success: true });
    const host = await mountControls();

    await click(controls(host, "Ocultar"));
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

    await click(controls(host, "Ocultar"));
    await settle();

    expect(host.textContent).toContain("No se encontró la publicación");
    expect(document.body.textContent).not.toContain("Sin cambios");
  });

  it("show the post again when it is hidden, and hide a reply through the reply action", async () => {
    hideMock.mockResolvedValue({ success: true });
    hideReplyMock.mockResolvedValue({ success: true });
    const hidden = await mountControls({ hidden: true });

    await click(controls(hidden, "Mostrar"));
    await settle();

    expect(hideMock).toHaveBeenCalledWith("t1", false);
    expect(document.body.textContent).toContain("Publicación visible de nuevo.");

    const reply = await mountControls({ kind: "reply", replyId: "r1" });

    await click(controls(reply, "Ocultar"));
    await settle();

    expect(hideReplyMock).toHaveBeenCalledWith("r1", true);
  });

  it("close the report as ignored with the note, and as resolved with the note", async () => {
    closeMock.mockResolvedValue({ success: true });
    const host = await mountControls();

    await typeInto(host.querySelector("textarea")!, "Spam");
    await click(controls(host, "Ignorar"));
    await settle();

    expect(closeMock).toHaveBeenCalledWith("p1", "DISMISSED", "Spam");
    expect(document.body.textContent).toContain("Reporte descartado.");

    await click(controls(host, "Marcar como resuelto"));
    await settle();

    expect(closeMock).toHaveBeenLastCalledWith("p1", "RESOLVED", "Spam");
    expect(document.body.textContent).toContain("Reporte resuelto.");
  });

  it("ask before suspending the account, then suspend it", async () => {
    suspendMock.mockResolvedValue({ success: true });
    const host = await mountControls();

    await click(controls(host, "Suspender…"));

    expect(suspendMock).not.toHaveBeenCalled();

    await click(controls(host, "Sí, suspender"));
    await settle();

    expect(suspendMock).toHaveBeenCalledWith("m1", true);
    expect(document.body.textContent).toContain("Cuenta suspendida y sesiones cerradas.");
  });

  it("mark Suspender… with a lock, not the trash can that means moving to the papelera", async () => {
    const host = await mountControls();
    const iconPath = (name: "lock" | "trash") => /<path d="([^"]+)"/.exec(renderToStaticMarkup(createElement(Icon, { name })))![1];
    const trigger = controls(host, "Suspender…").querySelector("svg path")!.getAttribute("d");

    expect(trigger).toBe(iconPath("lock"));
    expect(trigger).not.toBe(iconPath("trash"));
  });

  it("keep the confirmation of Suspender… as a labelled group that can be declined", async () => {
    const host = await mountControls();

    await click(controls(host, "Suspender…"));

    expect(host.querySelector('[role="group"][aria-label="Confirmar: suspender… Ana"]')?.textContent).toContain("«Ana» ya no podrá publicar");

    await click(controls(host, "No, conservar"));

    expect(controls(host, "Suspender…")).toBeDefined();
    expect(suspendMock).not.toHaveBeenCalled();
  });

  it("reactivate a suspended account, and reopen a locked thread", async () => {
    suspendMock.mockResolvedValue({ success: true });
    lockMock.mockResolvedValue({ success: true });
    const host = await mountControls({ authorSuspended: true, locked: true });

    expect(controls(host, "Suspender…")).toBeUndefined();

    await click(controls(host, "Reactivar la cuenta"));
    await click(controls(host, "Reabrir el hilo"));
    await settle();

    expect(suspendMock).toHaveBeenCalledWith("m1", false);
    expect(lockMock).toHaveBeenCalledWith("t1", false);
  });

  it("link to the full public thread", async () => {
    const host = await mountControls();

    expect(host.querySelector('a[href="/foro/hilo/t1"]')?.textContent).toContain("Ver el hilo completo");
  });
});
