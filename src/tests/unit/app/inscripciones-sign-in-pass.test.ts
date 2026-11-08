// @vitest-environment jsdom
import { createElement, type FunctionComponent, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { PassGoogleButton } from "../../../../app/inscripciones/_components/pass-google-button";
import { SignInPass } from "../../../../app/inscripciones/_components/sign-in-pass";
import { click, mount, unmountAll } from "@/tests/support/dom";

// The button takes its label as children, which `createElement` only accepts as extra arguments when the props type allows it.
const Button = PassGoogleButton as FunctionComponent<{ href: string; children?: ReactNode }>;
const START = "/foro/auth/google/start?next=%2Fforo%2Feventos";

afterEach(unmountAll);

describe("the Inscripciones sign-in (the student pass)", () => {
  const render = (props: Parameters<typeof SignInPass>[0] = { next: "/foro/eventos" }) => renderToStaticMarkup(createElement(SignInPass, props));

  it("is about the registrations, with the pass as its one headline and no forum wording", () => {
    const html = render();

    expect(html).toMatch(/<h1[^>]*>Su pase de estudiante<\/h1>/);
    expect(html).toContain("Inscripciones");
    // The words on the page, not the sign-in address (which is the forum's route).
    expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(/foro/i);
    expect(html).not.toContain("auth-branch");
  });

  it("has one Google button, the shared one, that comes back to the page it was asked for", () => {
    const html = render();
    const links = [...html.matchAll(/<a [^>]*>/g)].map((match) => match[0]);

    expect(links).toHaveLength(1);
    expect(links[0]).toContain(`href="${START}"`);
    expect(links[0]).toContain("google-button");
    expect(html).toContain("<svg");
    expect(html).toContain("Entrar con Google");
  });

  it("builds the return path from `next`, whatever it is", () => {
    expect(render({ next: "/inscripciones/taller-docker" })).toContain('href="/foro/auth/google/start?next=%2Finscripciones%2Ftaller-docker"');
  });

  it("says in one line that only the @unl.edu.ec address works", () => {
    expect(render()).toMatch(/Solo con su correo <b[^>]*>@unl\.edu\.ec<\/b>/);
  });

  it("shows no error unless a sign-in failed", () => {
    expect(render()).not.toContain('role="alert"');
  });

  it.each([
    ["unavailable", "no está disponible"],
    ["failed", "No se pudo completar"],
    ["denied", "@unl.edu.ec"],
    ["verification", "No pudimos verificar"],
  ] as const)("explains a failed sign-in (%s) in an alert and offers to try again", (problem, message) => {
    const html = render({ next: "/foro/eventos", problem });

    expect(html).toMatch(new RegExp(`role="alert"[^>]*>(?:(?!</div>|</p>).)*${message}`));
    expect(html).toContain("Intentar de nuevo");
    expect(html).toContain(`href="${START}"`);
    expect(html).not.toContain("El acceso al foro");
  });
});

describe("the pass's Google button while Google opens", () => {
  it("says it is opening and marks itself busy once clicked, and keeps the link", async () => {
    const host = await mount(createElement(Button, { href: START }, "Entrar con Google"));
    const link = host.querySelector("a")!;

    link.addEventListener("click", (event) => event.preventDefault());
    expect(host.querySelector("[aria-busy]")).toBeNull();
    expect(link.textContent).toContain("Entrar con Google");

    await click(link);

    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(host.textContent).toContain("Abriendo Google…");
    expect(host.querySelector("a")!.getAttribute("href")).toBe(START);
  });

  it("comes back to idle when the page is restored from the back/forward cache", async () => {
    const host = await mount(createElement(Button, { href: START }, "Entrar con Google"));

    host.querySelector("a")!.addEventListener("click", (event) => event.preventDefault());
    await click(host.querySelector("a")!);
    expect(host.textContent).toContain("Abriendo Google…");

    const { act } = await import("react");

    await act(async () => {
      window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    });

    expect(host.textContent).toContain("Entrar con Google");
    expect(host.querySelector("[aria-busy]")).toBeNull();
  });
});
