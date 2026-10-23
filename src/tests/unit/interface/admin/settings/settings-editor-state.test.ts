import { describe, expect, it } from "vitest";

import {
  createSettingsEditorState,
  hasUnsavedChanges,
  settingsEditorReducer,
  type SettingsValues,
} from "@/interface/admin/settings/settings-editor-state";

const SAVED: SettingsValues = { tagline: "Código abierto", description: "Resumen corto.", about: "Quiénes somos." };

function edited(state = createSettingsEditorState(SAVED)) {
  return settingsEditorReducer(state, { type: "edit" });
}

describe("settingsEditorReducer", () => {
  it("starts in read mode with the saved values as the draft", () => {
    const state = createSettingsEditorState(SAVED);

    expect(state).toEqual({ mode: "read", saved: SAVED, draft: SAVED, result: null });
    expect(hasUnsavedChanges(state)).toBe(false);
  });

  it("opens the fields on edit and ignores typing while in read mode", () => {
    const initial = createSettingsEditorState(SAVED);

    expect(edited(initial).mode).toBe("edit");
    expect(settingsEditorReducer(initial, { type: "change", field: "tagline", value: "Otro" })).toBe(initial);
  });

  it("tracks the draft while editing and reports unsaved changes only when it differs", () => {
    const typed = settingsEditorReducer(edited(), { type: "change", field: "tagline", value: "Otro lema" });

    expect(typed.draft).toEqual({ ...SAVED, tagline: "Otro lema" });
    expect(typed.saved).toEqual(SAVED);
    expect(hasUnsavedChanges(typed)).toBe(true);

    const reverted = settingsEditorReducer(typed, { type: "change", field: "tagline", value: SAVED.tagline });

    expect(hasUnsavedChanges(reverted)).toBe(false);
  });

  it("restores the saved values and returns to read mode on cancel", () => {
    const failed = settingsEditorReducer(
      settingsEditorReducer(edited(), { type: "change", field: "about", value: "Cambiado" }),
      { type: "result", result: { fieldErrors: { about: "Muy largo." } } },
    );
    const cancelled = settingsEditorReducer(failed, { type: "cancel" });

    expect(cancelled).toEqual({ mode: "read", saved: SAVED, draft: SAVED, result: null });
  });

  it("keeps edit mode and the draft open when the save fails validation", () => {
    const typed = settingsEditorReducer(edited(), { type: "change", field: "description", value: "x".repeat(301) });
    const failed = settingsEditorReducer(typed, { type: "result", result: { fieldErrors: { description: "Muy larga." } } });

    expect(failed.mode).toBe("edit");
    expect(failed.draft).toEqual(typed.draft);
    expect(failed.saved).toEqual(SAVED);
    expect(failed.result).toEqual({ fieldErrors: { description: "Muy larga." } });
    expect(hasUnsavedChanges(failed)).toBe(true);
  });

  it("promotes the draft to saved and returns to read mode on success, keeping the success result", () => {
    const typed = settingsEditorReducer(edited(), { type: "change", field: "tagline", value: "Nuevo lema" });
    const saved = settingsEditorReducer(typed, { type: "result", result: { success: true } });

    expect(saved).toEqual({
      mode: "read",
      saved: { ...SAVED, tagline: "Nuevo lema" },
      draft: { ...SAVED, tagline: "Nuevo lema" },
      result: { success: true },
    });
    expect(hasUnsavedChanges(saved)).toBe(false);
  });

  it("clears the previous outcome when editing starts again", () => {
    const saved = settingsEditorReducer(edited(), { type: "result", result: { success: true } });

    expect(settingsEditorReducer(saved, { type: "edit" }).result).toBeNull();
  });
});
