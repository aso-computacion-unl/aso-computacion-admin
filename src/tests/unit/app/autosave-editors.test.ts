// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, createElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../../app/admin/_components/toast";
import { AUTOSAVE_DELAY_MS } from "../../../../app/admin/_components/use-controlled-form";
import { BoardMemberForm, EMPTY_BOARD_MEMBER_FORM_VALUES } from "../../../../app/admin/board/_components/board-member-form";
import { CommandForm, EMPTY_COMMAND_FORM_VALUES } from "../../../../app/admin/commands/_components/command-form";
import { EventForm } from "../../../../app/admin/events/_components/event-form";
import { EMPTY_FAQ_FORM_VALUES, FaqForm } from "../../../../app/admin/faqs/_components/faq-form";
import { EMPTY_NEWS_FORM_VALUES, NewsForm } from "../../../../app/admin/news/_components/news-form";
import { EMPTY_PILLAR_FORM_VALUES, PillarForm } from "../../../../app/admin/pillars/_components/pillar-form";
import { EMPTY_SOCIAL_FORM_VALUES, SocialForm } from "../../../../app/admin/socials/_components/social-form";
import { EMPTY_SPONSOR_FORM_VALUES, SponsorForm } from "../../../../app/admin/sponsors/_components/sponsor-form";
import type { ActionResult } from "@/interface/admin/action-result";
import { EMPTY_EVENT_FORM_VALUES } from "@/interface/admin/events/event-form-values";
import { mount, typeInto, unmountAll } from "@/tests/support/dom";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(async () => {
  await unmountAll();
  vi.useRealTimers();
});

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;
interface EditorProps {
  action: Action;
  submitLabel: string;
  autosave?: boolean;
  initialValues: { isPublished: boolean };
}

// Each editor with a draft state, filled with what it needs to be valid. Textos del sitio has no draft and no switch.
const EDITORS: { name: string; form: (props: EditorProps) => ReactElement }[] = [
  { name: "events", form: (props) => createElement(EventForm, { ...props, initialValues: { ...EMPTY_EVENT_FORM_VALUES, title: "Taller de Git", slug: "taller-de-git", date: "2026-12-01", ...props.initialValues } }) },
  { name: "FAQs", form: (props) => createElement(FaqForm, { ...props, initialValues: { ...EMPTY_FAQ_FORM_VALUES, question: "¿Cómo entro?", answer: "Con su cuenta.", ...props.initialValues } }) },
  { name: "news", form: (props) => createElement(NewsForm, { ...props, isEditing: true, cover: null, initialValues: { ...EMPTY_NEWS_FORM_VALUES, title: "Becas 2026", slug: "becas-2026", summary: "Se abren las becas.", body: "Texto.", publishedAt: "2026-11-02", ...props.initialValues } }) },
  { name: "board", form: (props) => createElement(BoardMemberForm, { ...props, initialValues: { ...EMPTY_BOARD_MEMBER_FORM_VALUES, name: "Ana Torres", role: "Presidenta", ...props.initialValues } }) },
  { name: "pillars", form: (props) => createElement(PillarForm, { ...props, initialValues: { ...EMPTY_PILLAR_FORM_VALUES, word: "VOZ", title: "Representación", text: "Llevamos su voz.", ...props.initialValues } }) },
  { name: "commands", form: (props) => createElement(CommandForm, { ...props, initialValues: { ...EMPTY_COMMAND_FORM_VALUES, command: "ayuda", description: "Lista los comandos", output: "Escriba un comando", ...props.initialValues } }) },
  { name: "sponsors", form: (props) => createElement(SponsorForm, { ...props, initialValues: { ...EMPTY_SPONSOR_FORM_VALUES, name: "Acme", url: "https://acme.example", ...props.initialValues } }) },
  { name: "socials", form: (props) => createElement(SocialForm, { ...props, initialValues: { ...EMPTY_SOCIAL_FORM_VALUES, platform: "instagram", label: "Instagram", handle: "@aso", url: "https://instagram.com/aso", ...props.initialValues } }) },
];

const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const firstText = (host: HTMLElement) => host.querySelector<HTMLInputElement>('input[required]:not([type="checkbox"]), textarea[required]')!;
const status = (host: HTMLElement) => host.querySelector('[data-slot="autosave-status"]')?.textContent ?? null;

describe.each(EDITORS)("the $name editor", ({ form }) => {
  const mountEditor = async (action: Action, props: { autosave?: boolean; isPublished?: boolean }) =>
    mount(createElement(ToastProvider, null, form({ action, submitLabel: "Guardar cambios", autosave: props.autosave, initialValues: { isPublished: props.isPublished ?? false } })));

  it("saves an edited draft by itself and says Guardado", async () => {
    const action = vi.fn<Action>(async () => ({ success: true }));
    const host = await mountEditor(action, { autosave: true });
    const edited = `${firstText(host).value}!`;

    await typeInto(firstText(host), edited);
    await advance(AUTOSAVE_DELAY_MS);

    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]?.[1].get(firstText(host).name)).toBe(edited);
    expect(status(host)).toBe("Guardado");
  });

  it("does not save on a create page", async () => {
    const action = vi.fn<Action>(async () => ({ success: true }));
    const host = await mountEditor(action, {});

    await typeInto(firstText(host), `${firstText(host).value}!`);
    await advance(AUTOSAVE_DELAY_MS * 3);

    expect(action).not.toHaveBeenCalled();
    expect(status(host)).toBeNull();
  });

  it("does not save a published item", async () => {
    const action = vi.fn<Action>(async () => ({ success: true }));
    const host = await mountEditor(action, { autosave: true, isPublished: true });

    await typeInto(firstText(host), `${firstText(host).value}!`);
    await advance(AUTOSAVE_DELAY_MS * 3);

    expect(action).not.toHaveBeenCalled();
  });
});

describe("which pages turn autosave on", () => {
  const page = (route: string, name: string) => readFileSync(join(process.cwd(), "app/admin", route, name, "page.tsx"), "utf8");
  const ROUTES = ["events", "faqs", "news", "board", "pillars", "commands", "sponsors", "socials"];

  it.each(ROUTES)("%s: the edit page does, the create page never", (route) => {
    expect(page(route, "[id]/edit")).toMatch(/\sautosave[\s/>]/);
    expect(page(route, "new")).not.toContain("autosave");
  });

  it("Textos del sitio has no draft: its form does not know autosave", () => {
    expect(readFileSync(join(process.cwd(), "app/admin/settings/_components/settings-form.tsx"), "utf8")).not.toContain("autosave");
  });
});
