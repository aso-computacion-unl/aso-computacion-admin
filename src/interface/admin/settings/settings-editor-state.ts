import type { ActionResult } from "../action-result";

export interface SettingsValues {
  tagline: string;
  description: string;
  about: string;
}

export interface SettingsEditorState {
  mode: "read" | "edit";
  /** What is stored: shown in read mode and restored by cancel. */
  saved: SettingsValues;
  /** What the fields hold; the preview follows it. Equal to `saved` in read mode. */
  draft: SettingsValues;
  /** Outcome of the last save, cleared when editing starts or is cancelled. */
  result: ActionResult | null;
}

export type SettingsEditorAction =
  | { type: "edit" }
  | { type: "change"; field: keyof SettingsValues; value: string }
  | { type: "cancel" }
  | { type: "result"; result: ActionResult };

export function createSettingsEditorState(saved: SettingsValues): SettingsEditorState {
  return { mode: "read", saved, draft: saved, result: null };
}

export function hasUnsavedChanges({ mode, saved, draft }: SettingsEditorState): boolean {
  return mode === "edit" && (saved.tagline !== draft.tagline || saved.description !== draft.description || saved.about !== draft.about);
}

export function settingsEditorReducer(state: SettingsEditorState, action: SettingsEditorAction): SettingsEditorState {
  switch (action.type) {
    case "edit":
      return { ...state, mode: "edit", result: null };
    case "change":
      return state.mode === "edit" ? { ...state, draft: { ...state.draft, [action.field]: action.value } } : state;
    case "cancel":
      return createSettingsEditorState(state.saved);
    case "result":
      // A failed save keeps the fields open with what was typed; a successful one makes the draft the saved text.
      return action.result.success
        ? { mode: "read", saved: state.draft, draft: state.draft, result: action.result }
        : { ...state, result: action.result };
  }
}
