// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { routerMock, createThreadMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() },
  createThreadMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/interface/forum/forum-posting", () => ({ createForumThread: createThreadMock, signOutOfForum: vi.fn() }));

import { NewThreadForm } from "../../../../app/foro/_components/new-thread-form";
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

describe("the new-thread form", () => {
  async function filledForm() {
    const host = await mount(createElement(NewThreadForm, { categorySlug: "programacion" }));

    await typeInto(field(host, 'input[name="title"]'), "¿Cómo depuro un use-after-free?");
    await typeInto(field(host, 'textarea[name="body"]'), "Tengo un **use-after-free**.");

    return host;
  }

  it("labels its fields and offers the formatting toolbar, a preview and a way back", async () => {
    const host = await mount(createElement(NewThreadForm, { categorySlug: "programacion" }));

    expect(host.querySelector("label[for]")?.textContent).toBe("Título");
    expect(host.textContent).toContain("Texto (Markdown)");
    expect(host.querySelectorAll('[role="toolbar"] button')).toHaveLength(5);
    expect(host.textContent).toContain("Vista previa");
    expect(host.querySelector('a[href="/foro?categoria=programacion"]')?.textContent).toBe("Cancelar");
  });

  it("previews the Markdown while typing", async () => {
    const host = await filledForm();

    expect(host.querySelector("strong")?.textContent).toBe("use-after-free");
  });

  it("publishes through the existing action with the category, the title and the body, then opens the new thread", async () => {
    createThreadMock.mockResolvedValue({ success: true, id: "thread-9" });
    const host = await filledForm();

    await click(submitButton(host));
    await settle();

    expect(createThreadMock).toHaveBeenCalledOnce();
    expect(createThreadMock.mock.calls[0]![0]).toBe("programacion");
    expect(sentForm(createThreadMock)).toEqual({ title: "¿Cómo depuro un use-after-free?", body: "Tengo un **use-after-free**." });
    expect(routerMock.push).toHaveBeenCalledWith("/foro/hilo/thread-9");
    expect(submitButton(host).textContent).toBe("Publicando…");
  });

  it("shows a field error on the field, marks it invalid and keeps what was typed", async () => {
    createThreadMock.mockResolvedValue({ fieldErrors: { title: "El título es obligatorio y admite hasta 120 caracteres." } });
    const host = await filledForm();

    await click(submitButton(host));
    await settle();

    const title = field<HTMLInputElement>(host, 'input[name="title"]');

    expect(title.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(title.getAttribute("aria-describedby")!)?.textContent).toContain("obligatorio");
    expect(title.value).toBe("¿Cómo depuro un use-after-free?");
    expect(field<HTMLTextAreaElement>(host, 'textarea[name="body"]').value).toBe("Tengo un **use-after-free**.");
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it.each([
    ["a suspended member", { error: "Su cuenta no puede participar en el foro." }, "Su cuenta no puede participar en el foro."],
    ["a closed session", { error: "Inicie sesión para participar en el foro." }, "Inicie sesión para participar en el foro."],
    ["a member posting too fast", { error: "Está publicando muy rápido. Espere un momento y vuelva a intentarlo.", retryAfterSeconds: 42 }, "Puede volver a intentarlo en 42 s."],
  ])("announces the refusal of %s as an alert with a way back", async (_label, result, expected) => {
    createThreadMock.mockResolvedValue(result);
    const host = await filledForm();

    await click(submitButton(host));
    await settle();

    const alert = field(host, '[role="alert"]');

    expect(alert.textContent).toContain(expected);
    expect(alert.querySelector('a[href="/foro"]')?.textContent).toBe("Volver al foro");
    expect(field<HTMLTextAreaElement>(host, 'textarea[name="body"]').value).not.toBe("");
  });

  it("turns a rejected call into an error message instead of crashing", async () => {
    createThreadMock.mockRejectedValue(new Error("network"));
    const host = await filledForm();

    await click(submitButton(host));
    await settle();

    expect(field(host, '[role="alert"]').textContent).toContain("Ocurrió un error inesperado.");
  });

  it("does not submit twice while the first call is pending", async () => {
    let resolve!: (value: unknown) => void;
    createThreadMock.mockReturnValue(new Promise((done) => (resolve = done)));
    const host = await filledForm();

    await click(submitButton(host));
    await click(submitButton(host));

    expect(createThreadMock).toHaveBeenCalledOnce();
    resolve({ error: "x" });
    await settle();
  });

  it("formats the selection with the toolbar", async () => {
    const host = await mount(createElement(NewThreadForm, { categorySlug: "programacion" }));
    const body = field<HTMLTextAreaElement>(host, 'textarea[name="body"]');

    await typeInto(body, "Hola mundo");
    body.setSelectionRange(5, 10);
    await click(host.querySelector('button[aria-label="Negrita"]')!);

    expect(body.value).toBe("Hola **mundo**");
  });
});
