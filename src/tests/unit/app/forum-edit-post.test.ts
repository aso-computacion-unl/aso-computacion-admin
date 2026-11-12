// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { routerMock, editThreadMock, editReplyMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() },
  editThreadMock: vi.fn(),
  editReplyMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/interface/forum/forum-posting", () => ({ editForumThread: editThreadMock, editForumReply: editReplyMock, signOutOfForum: vi.fn() }));

import { EditPost } from "../../../../app/foro/_components/edit-post";
import { click, mount, settle, typeInto, unmountAll } from "@/tests/support/dom";

const field = <T extends HTMLElement>(host: HTMLElement, selector: string) => host.querySelector<T>(selector)!;
const buttonNamed = (host: HTMLElement, text: string) => [...host.querySelectorAll("button")].find((button) => button.textContent?.includes(text));
const sentForm = (mock: ReturnType<typeof vi.fn>): Record<string, string> => Object.fromEntries((mock.mock.calls.at(-1)![2] as FormData).entries() as Iterable<[string, string]>);

const threadTarget = { kind: "thread" as const, id: "t1", threadId: "t1", title: "Segmentation fault", body: "Mi programa revienta." };
const replyTarget = { kind: "reply" as const, id: "r1", threadId: "t1", body: "Libere dos veces." };

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

afterEach(async () => {
  await unmountAll();
});

describe("editing one's own post (D2)", () => {
  it("shows only an «Editar» button until it is opened", async () => {
    const host = await mount(createElement(EditPost, { target: replyTarget }));

    expect(buttonNamed(host, "Editar")).toBeDefined();
    expect(host.querySelector("form")).toBeNull();
  });

  it("opens the reply with its current text and sends the new one through the reply edit action", async () => {
    editReplyMock.mockResolvedValue({ success: true, id: "r1" });
    const host = await mount(createElement(EditPost, { target: replyTarget }));

    await click(buttonNamed(host, "Editar")!);
    expect(field<HTMLTextAreaElement>(host, 'textarea[name="body"]').value).toBe("Libere dos veces.");
    expect(host.querySelector('input[name="title"]')).toBeNull();

    await typeInto(field(host, 'textarea[name="body"]'), "Libere el puntero una sola vez.");
    await click(field(host, 'button[type="submit"]'));
    await settle();

    expect(editReplyMock.mock.calls[0]![0]).toBe("r1");
    expect(sentForm(editReplyMock)).toEqual({ body: "Libere el puntero una sola vez." });
    expect(editThreadMock).not.toHaveBeenCalled();
  });

  it("opens the thread with its title and text and sends both through the thread edit action", async () => {
    editThreadMock.mockResolvedValue({ success: true, id: "t1" });
    const host = await mount(createElement(EditPost, { target: threadTarget }));

    await click(buttonNamed(host, "Editar")!);
    expect(field<HTMLInputElement>(host, 'input[name="title"]').value).toBe("Segmentation fault");
    expect(field<HTMLTextAreaElement>(host, 'textarea[name="body"]').value).toBe("Mi programa revienta.");

    await typeInto(field(host, 'input[name="title"]'), "Segmentation fault al liberar memoria");
    await click(field(host, 'button[type="submit"]'));
    await settle();

    expect(editThreadMock.mock.calls[0]![0]).toBe("t1");
    expect(sentForm(editThreadMock)).toEqual({ title: "Segmentation fault al liberar memoria", body: "Mi programa revienta." });
    expect(editReplyMock).not.toHaveBeenCalled();
  });

  it("closes and refreshes the thread once saved, so the post shows the new text and «editado»", async () => {
    editReplyMock.mockResolvedValue({ success: true, id: "r1" });
    const host = await mount(createElement(EditPost, { target: replyTarget }));

    await click(buttonNamed(host, "Editar")!);
    await typeInto(field(host, 'textarea[name="body"]'), "Otro texto");
    await click(field(host, 'button[type="submit"]'));
    await settle();

    expect(routerMock.refresh).toHaveBeenCalledOnce();
    expect(host.querySelector("form")).toBeNull();
    expect(buttonNamed(host, "Editar")).toBeDefined();
  });

  it("keeps the form open with the text and says why when the edit is refused", async () => {
    editReplyMock.mockResolvedValue({ error: "Este hilo está cerrado y no admite más respuestas." });
    const host = await mount(createElement(EditPost, { target: replyTarget }));

    await click(buttonNamed(host, "Editar")!);
    await typeInto(field(host, 'textarea[name="body"]'), "Otro texto");
    await click(field(host, 'button[type="submit"]'));
    await settle();

    expect(host.textContent).toContain("Este hilo está cerrado y no admite más respuestas.");
    expect(field<HTMLTextAreaElement>(host, 'textarea[name="body"]').value).toBe("Otro texto");
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("shows a field error from the server next to the field", async () => {
    editReplyMock.mockResolvedValue({ error: "Revise los campos marcados.", fieldErrors: { body: "Escriba la respuesta." } });
    const host = await mount(createElement(EditPost, { target: replyTarget }));

    await click(buttonNamed(host, "Editar")!);
    await typeInto(field(host, 'textarea[name="body"]'), "");
    await click(field(host, 'button[type="submit"]'));
    await settle();

    expect(host.textContent).toContain("Escriba la respuesta.");
  });

  it("drops the changes on «Cancelar» and sends nothing", async () => {
    const host = await mount(createElement(EditPost, { target: replyTarget }));

    await click(buttonNamed(host, "Editar")!);
    await typeInto(field(host, 'textarea[name="body"]'), "Cambio que no quiero");
    await click(buttonNamed(host, "Cancelar")!);

    expect(host.querySelector("form")).toBeNull();
    expect(editReplyMock).not.toHaveBeenCalled();

    await click(buttonNamed(host, "Editar")!);
    expect(field<HTMLTextAreaElement>(host, 'textarea[name="body"]').value).toBe("Libere dos veces.");
  });
});
