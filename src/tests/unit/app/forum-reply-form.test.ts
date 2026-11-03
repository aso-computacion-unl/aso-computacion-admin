// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { routerMock, replyMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() },
  replyMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/interface/forum/forum-posting", () => ({ replyToForumThread: replyMock, signOutOfForum: vi.fn() }));

import { ReplyForm } from "../../../../app/foro/_components/reply-form";
import { click, mount, settle, typeInto, unmountAll } from "@/tests/support/dom";

const field = <T extends HTMLElement>(host: HTMLElement, selector: string) => host.querySelector<T>(selector)!;
const submitButton = (host: HTMLElement) => field<HTMLButtonElement>(host, 'button[type="submit"]');
const sentForm = (mock: ReturnType<typeof vi.fn>): Record<string, string> => Object.fromEntries((mock.mock.calls.at(-1)![2] as FormData).entries() as Iterable<[string, string]>);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await unmountAll();
});

describe("the reply form", () => {
  it("sends the reply through the existing action for this thread", async () => {
    replyMock.mockResolvedValue({ success: true, id: "reply-3" });
    const host = await mount(createElement(ReplyForm, { threadId: "thread-1" }));

    expect(host.querySelector("label")?.textContent).toBe("Su respuesta");
    await typeInto(field(host, 'textarea[name="body"]'), "Guarde el siguiente antes de liberar.");
    await click(submitButton(host));
    await settle();

    expect(replyMock.mock.calls[0]![0]).toBe("thread-1");
    expect(sentForm(replyMock)).toEqual({ body: "Guarde el siguiente antes de liberar." });
  });

  it("clears the box, confirms and refreshes the thread once published", async () => {
    replyMock.mockResolvedValue({ success: true, id: "reply-3" });
    const host = await mount(createElement(ReplyForm, { threadId: "thread-1" }));

    await typeInto(field(host, 'textarea[name="body"]'), "Una respuesta");
    await click(submitButton(host));
    await settle();

    expect(field<HTMLTextAreaElement>(host, 'textarea[name="body"]').value).toBe("");
    expect(host.textContent).toContain("Respuesta publicada.");
    expect(routerMock.refresh).toHaveBeenCalledOnce();
  });

  it("keeps the text and says why when the reply is refused", async () => {
    replyMock.mockResolvedValue({ error: "Este hilo está cerrado y no admite más respuestas." });
    const host = await mount(createElement(ReplyForm, { threadId: "thread-1" }));

    await typeInto(field(host, 'textarea[name="body"]'), "Una respuesta");
    await click(submitButton(host));
    await settle();

    expect(field(host, '[role="alert"]').textContent).toContain("cerrado");
    expect(field<HTMLTextAreaElement>(host, 'textarea[name="body"]').value).toBe("Una respuesta");
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("shows the body error under the field", async () => {
    replyMock.mockResolvedValue({ fieldErrors: { body: "El texto es obligatorio." } });
    const host = await mount(createElement(ReplyForm, { threadId: "thread-1" }));

    await click(submitButton(host));
    await settle();

    expect(field(host, "textarea").getAttribute("aria-invalid")).toBe("true");
    expect(host.textContent).toContain("El texto es obligatorio.");
  });
});
