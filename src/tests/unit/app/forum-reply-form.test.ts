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
  window.sessionStorage.clear();
});

afterEach(async () => {
  await unmountAll();
});

describe("the reply form", () => {
  it("sends the reply through the existing action for this thread", async () => {
    replyMock.mockResolvedValue({ success: true, id: "reply-3" });
    const host = await mount(createElement(ReplyForm, { threadId: "thread-1", memberId: "m1" }));

    expect(host.querySelector("label")?.textContent).toBe("Su respuesta");
    await typeInto(field(host, 'textarea[name="body"]'), "Guarde el siguiente antes de liberar.");
    await click(submitButton(host));
    await settle();

    expect(replyMock.mock.calls[0]![0]).toBe("thread-1");
    expect(sentForm(replyMock)).toEqual({ body: "Guarde el siguiente antes de liberar." });
  });

  it("clears the box, confirms and refreshes the thread once published", async () => {
    replyMock.mockResolvedValue({ success: true, id: "reply-3" });
    const host = await mount(createElement(ReplyForm, { threadId: "thread-1", memberId: "m1" }));

    await typeInto(field(host, 'textarea[name="body"]'), "Una respuesta");
    await click(submitButton(host));
    await settle();

    expect(field<HTMLTextAreaElement>(host, 'textarea[name="body"]').value).toBe("");
    expect(host.textContent).toContain("Respuesta publicada.");
    expect(routerMock.refresh).toHaveBeenCalledOnce();
  });

  it("keeps the text and says why when the reply is refused", async () => {
    replyMock.mockResolvedValue({ error: "Este hilo está cerrado y no admite más respuestas." });
    const host = await mount(createElement(ReplyForm, { threadId: "thread-1", memberId: "m1" }));

    await typeInto(field(host, 'textarea[name="body"]'), "Una respuesta");
    await click(submitButton(host));
    await settle();

    expect(field(host, '[role="alert"]').textContent).toContain("cerrado");
    expect(field<HTMLTextAreaElement>(host, 'textarea[name="body"]').value).toBe("Una respuesta");
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("shows the body error under the field", async () => {
    replyMock.mockResolvedValue({ fieldErrors: { body: "El texto es obligatorio." } });
    const host = await mount(createElement(ReplyForm, { threadId: "thread-1", memberId: "m1" }));

    await click(submitButton(host));
    await settle();

    expect(field(host, "textarea").getAttribute("aria-invalid")).toBe("true");
    expect(host.textContent).toContain("El texto es obligatorio.");
  });

  describe("when the session ended while writing (D5)", () => {
    it("keeps the reply, offers a sign-in that comes back to this thread, and gives the text back afterwards", async () => {
      replyMock.mockResolvedValue({ error: "Inicie sesión para participar en el foro.", sessionExpired: true });
      const host = await mount(createElement(ReplyForm, { threadId: "thread-1", memberId: "m1" }));

      await typeInto(field(host, 'textarea[name="body"]'), "Una respuesta larga");
      await click(submitButton(host));
      await settle();

      const alert = field(host, '[role="alert"]');

      expect(alert.querySelector('a[href="/foro?next=%2Fforo%2Fhilo%2Fthread-1"]')?.textContent).toBe("Iniciar sesión");
      expect(field<HTMLTextAreaElement>(host, 'textarea[name="body"]').value).toBe("Una respuesta larga");

      await unmountAll();
      const again = await mount(createElement(ReplyForm, { threadId: "thread-1", memberId: "m1" }));

      expect(field<HTMLTextAreaElement>(again, 'textarea[name="body"]').value).toBe("Una respuesta larga");
    });

    it("gives the text back only to the member who typed it: another member on the same machine finds the box empty", async () => {
      const host = await mount(createElement(ReplyForm, { threadId: "thread-1", memberId: "m1" }));

      await typeInto(field(host, 'textarea[name="body"]'), "El texto de Ana");
      await unmountAll();

      const other = await mount(createElement(ReplyForm, { threadId: "thread-1", memberId: "m2" }));

      expect(field<HTMLTextAreaElement>(other, 'textarea[name="body"]').value).toBe("");
      expect(window.sessionStorage.length).toBe(0);
      await unmountAll();

      // It was dropped, not hidden: the first member does not get it back either.
      expect(field<HTMLTextAreaElement>(await mount(createElement(ReplyForm, { threadId: "thread-1", memberId: "m1" })), 'textarea[name="body"]').value).toBe("");
    });

    it("keeps one draft per thread and forgets it once the reply is published", async () => {
      replyMock.mockResolvedValue({ success: true, id: "reply-3" });
      const host = await mount(createElement(ReplyForm, { threadId: "thread-1", memberId: "m1" }));

      await typeInto(field(host, 'textarea[name="body"]'), "Una respuesta");
      await unmountAll();

      expect(field<HTMLTextAreaElement>(await mount(createElement(ReplyForm, { threadId: "thread-2", memberId: "m1" })), 'textarea[name="body"]').value).toBe("");
      await unmountAll();

      const again = await mount(createElement(ReplyForm, { threadId: "thread-1", memberId: "m1" }));

      await click(submitButton(again));
      await settle();
      await unmountAll();

      expect(field<HTMLTextAreaElement>(await mount(createElement(ReplyForm, { threadId: "thread-1", memberId: "m1" })), 'textarea[name="body"]').value).toBe("");
      expect(window.sessionStorage.length).toBe(0);
    });
  });
});
