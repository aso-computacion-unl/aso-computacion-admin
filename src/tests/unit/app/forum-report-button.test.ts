// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { threadMock, replyMock } = vi.hoisted(() => ({ threadMock: vi.fn(), replyMock: vi.fn() }));

vi.mock("@/interface/forum/forum-moderation", () => ({ reportForumThread: threadMock, reportForumReply: replyMock }));

import { ReportButton } from "../../../../app/foro/_components/report-button";
import { click, mount, settle, typeInto, unmountAll } from "@/tests/support/dom";

const sentReason = (mock: ReturnType<typeof vi.fn>) => (mock.mock.calls.at(-1)![2] as FormData).get("reason");
const opener = (host: HTMLElement) => [...host.querySelectorAll("button")].find((button) => button.textContent === "Reportar")!;
const submit = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const select = (host: HTMLElement) => host.querySelector<HTMLSelectElement>("select")!;

async function choose(host: HTMLElement, value: string) {
  const { act } = await import("react");

  await act(async () => {
    select(host).value = value;
    select(host).dispatchEvent(new Event("change", { bubbles: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await unmountAll();
});

describe("the report button", () => {
  it("starts as a plain «Reportar» with no form", async () => {
    const host = await mount(createElement(ReportButton, { target: { kind: "thread", id: "t1" } }));

    expect(opener(host).getAttribute("aria-expanded")).toBe("false");
    expect(host.querySelector("select")).toBeNull();
  });

  it("opens a form with a reason to choose and an optional note, and closes it again on cancel", async () => {
    const host = await mount(createElement(ReportButton, { target: { kind: "thread", id: "t1" } }));

    await click(opener(host));

    expect(opener(host).getAttribute("aria-expanded")).toBe("true");
    expect(host.querySelector("label")?.textContent).toBe("Motivo");
    expect([...select(host).options].map((option) => option.textContent)).toEqual(["Spam o publicidad", "Contenido ofensivo o acoso", "Fuera de tema", "Información falsa o engañosa", "Otro motivo"]);
    expect(host.textContent).toContain("Nota (opcional)");

    await click([...host.querySelectorAll("button")].find((button) => button.textContent === "Cancelar")!);

    expect(host.querySelector("select")).toBeNull();
  });

  it("reports a thread with the chosen reason, joins the note to it and confirms", async () => {
    threadMock.mockResolvedValue({ success: true });
    const host = await mount(createElement(ReportButton, { target: { kind: "thread", id: "t1" } }));

    await click(opener(host));
    await choose(host, "offensive");
    await typeInto(host.querySelector("textarea")!, "  Insulta a otra persona  ");
    await click(submit(host));
    await settle();

    expect(threadMock.mock.calls[0]![0]).toBe("t1");
    expect(sentReason(threadMock)).toBe("Contenido ofensivo o acoso: Insulta a otra persona");
    expect(host.querySelector('[role="status"]')?.textContent).toContain("Reporte enviado");
    expect(host.querySelector("select")).toBeNull();
    expect(host.querySelector("button")).toBeNull();
  });

  it("sends just the reason when there is no note, and uses the reply action for a reply", async () => {
    replyMock.mockResolvedValue({ success: true });
    const host = await mount(createElement(ReportButton, { target: { kind: "reply", id: "r1" } }));

    await click(opener(host));
    await click(submit(host));
    await settle();

    expect(replyMock.mock.calls[0]![0]).toBe("r1");
    expect(sentReason(replyMock)).toBe("Spam o publicidad");
    expect(threadMock).not.toHaveBeenCalled();
  });

  it("shows the already-reported state, not an error, when the member reported the post before", async () => {
    threadMock.mockResolvedValue({ error: "Ya reportó esta publicación. El equipo la revisará.", alreadyReported: true });
    const host = await mount(createElement(ReportButton, { target: { kind: "thread", id: "t1" } }));

    await click(opener(host));
    await click(submit(host));
    await settle();

    expect(host.querySelector('[role="status"]')?.textContent).toContain("Ya reportó esta publicación");
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelector("button")).toBeNull();
  });

  it("keeps the form and says why when the server refuses (a suspended account, a closed session)", async () => {
    threadMock.mockResolvedValue({ error: "Inicie sesión para participar en el foro." });
    const host = await mount(createElement(ReportButton, { target: { kind: "thread", id: "t1" } }));

    await click(opener(host));
    await typeInto(host.querySelector("textarea")!, "Nota");
    await click(submit(host));
    await settle();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Inicie sesión para participar en el foro.");
    expect(host.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe("Nota");
  });

  it("limits the note so the whole reason stays within what the server accepts", async () => {
    const host = await mount(createElement(ReportButton, { target: { kind: "thread", id: "t1" } }));

    await click(opener(host));

    expect(Number(host.querySelector("textarea")!.getAttribute("maxlength"))).toBeLessThanOrEqual(450);
  });
});
