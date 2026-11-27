// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { filterActions, isPaletteChord, isTypingTarget, paletteActions, shortcutTarget } from "../../../../app/admin/_components/command-palette";

const key = (value: string, modifiers: Partial<Record<"ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "repeat" | "isComposing", boolean>> = {}) => ({
  key: value,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers,
});
const free = { typing: false, dialogOpen: false };

describe("single-key shortcuts", () => {
  it("send E, N and P to the create pages", () => {
    expect(shortcutTarget(key("e"), free)).toBe("/admin/events/new");
    expect(shortcutTarget(key("n"), free)).toBe("/admin/news/new");
    expect(shortcutTarget(key("p"), free)).toBe("/admin/faqs/new");
    // Caps Lock on: the key is upper case without Shift.
    expect(shortcutTarget(key("E"), free)).toBe("/admin/events/new");
  });

  it("leave every other key alone", () => {
    expect(shortcutTarget(key("x"), free)).toBeNull();
    expect(shortcutTarget(key("Enter"), free)).toBeNull();
  });

  it("are ignored while typing or with a dialog open", () => {
    expect(shortcutTarget(key("e"), { typing: true, dialogOpen: false })).toBeNull();
    expect(shortcutTarget(key("e"), { typing: false, dialogOpen: true })).toBeNull();
  });

  it.each(["ctrlKey", "metaKey", "altKey", "shiftKey", "repeat", "isComposing"] as const)("are ignored with %s", (modifier) => {
    expect(shortcutTarget(key("n", { [modifier]: true }), free)).toBeNull();
  });
});

describe("isTypingTarget", () => {
  it("is true inside a field, a select and an editable region", () => {
    document.body.innerHTML = `
      <input id="input" /><textarea id="area"></textarea><select id="select"><option>a</option></select>
      <div contenteditable="true"><p id="inside">texto</p></div>
      <div contenteditable="false"><p id="locked">texto</p></div>
      <button id="button">Ir</button>`;

    for (const id of ["input", "area", "select", "inside"]) expect(isTypingTarget(document.getElementById(id)), id).toBe(true);
    for (const id of ["locked", "button"]) expect(isTypingTarget(document.getElementById(id)), id).toBe(false);
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("isPaletteChord", () => {
  it("is Ctrl K or ⌘ K, and nothing else", () => {
    expect(isPaletteChord(key("k", { ctrlKey: true }))).toBe(true);
    expect(isPaletteChord(key("k", { metaKey: true }))).toBe(true);
    expect(isPaletteChord(key("K", { ctrlKey: true }))).toBe(true);
    expect(isPaletteChord(key("k"))).toBe(false);
    expect(isPaletteChord(key("k", { ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isPaletteChord(key("k", { ctrlKey: true, altKey: true }))).toBe(false);
  });
});

describe("palette actions", () => {
  it("hide the administrator's pages from an editor, and list each page once", () => {
    const admin = paletteActions("ADMIN").map((action) => action.href);
    const editor = paletteActions("EDITOR").map((action) => action.href);

    expect(admin).toContain("/admin/registro");
    expect(editor).not.toContain("/admin/registro");
    expect(editor).not.toContain("/admin/usuarios");
    expect(new Set(admin).size).toBe(admin.length);
  });

  it("start with the creates, then the forum review", () => {
    const labels = paletteActions("EDITOR").map((action) => action.label);

    expect(labels.slice(0, 9)).toEqual([
      "Nuevo evento",
      "Nueva novedad",
      "Nueva pregunta",
      "Agregar integrante de la directiva",
      "Nuevo pilar",
      "Nuevo comando",
      "Nuevo aliado",
      "Agregar red",
      "Revisar el foro",
    ]);
  });
});

describe("filterActions", () => {
  const actions = paletteActions("ADMIN");
  const labels = (query: string) => filterActions(actions, query).map((action) => action.label);

  it("keeps every action, in order, for an empty query", () => {
    expect(labels("  ")).toEqual(actions.map((action) => action.label));
  });

  it("ranks a label that starts with the query first", () => {
    expect(labels("nove")[0]).toBe("Novedades");
    expect(labels("nueva n")[0]).toBe("Nueva novedad");
  });

  it("ignores case and accents", () => {
    expect(labels("PAPELERA")).toEqual(["Papelera"]);
    expect(labels("rapida")).toEqual([]);
    expect(labels("sesion")).toContain("Mis sesiones");
  });

  it("needs every word to match, in the label or its keywords", () => {
    expect(labels("crear pilar")).toEqual(["Nuevo pilar"]);
    expect(labels("noticia")).toContain("Nueva novedad");
    expect(labels("crear zzz")).toEqual([]);
  });

  it("puts word starts before matches inside a word", () => {
    // «Redes» starts with it, «Agregar red» has a word that does, though it comes first in the list.
    expect(labels("red").slice(0, 2)).toEqual(["Redes", "Agregar red"]);
    expect(labels("ciones")).toEqual(["Inscripciones"]);
  });
});
