"use client";

import { startTransition, useActionState, useEffect, useReducer, useRef, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/components/icons";
import type { ActionResult } from "@/interface/admin/action-result";
import { SETTINGS_FIELD_MESSAGES } from "@/interface/admin/field-messages";
import { toFormData } from "@/interface/admin/form-fields";
import {
  createSettingsEditorState,
  hasUnsavedChanges,
  settingsEditorReducer,
  type SettingsValues,
} from "@/interface/admin/settings/settings-editor-state";

import { ActionBar, Field, FormFeedback } from "../../_components/form-parts";
import { FormColumns, Panel } from "../../_components/form-layout";
import { PUBLISHED_MESSAGE, PublishPreview, usePublishFlow } from "../../_components/publish-preview";
import { collectFieldErrors, useFocusFirstInvalid, useUnsavedChangesGuard } from "../../_components/use-controlled-form";
import { SETTINGS_PUBLISH_FIELDS, SettingsPreview } from "./settings-preview";
import { SettingsReadView } from "./settings-read-view";

export type SettingsFormValues = SettingsValues;

export const EMPTY_SETTINGS_FORM_VALUES: SettingsFormValues = { tagline: "", description: "", about: "" };

interface SettingsFormProps {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  initialValues?: SettingsFormValues;
}

/**
 * Shows the saved texts and opens the fields only on "Editar". The draft lives here (not in the fields);
 * the form is submitted by hand through `startTransition`, so a failed save keeps what was typed. The texts
 * are always live: "Publicar" checks the fields and asks with the preview, "Sí, publicar" sends them.
 */
export function SettingsForm({ action, initialValues = EMPTY_SETTINGS_FORM_VALUES }: SettingsFormProps) {
  const [state, dispatch] = useReducer(settingsEditorReducer, initialValues, createSettingsEditorState);
  const [, formAction, isPending] = useActionState(async (previous: ActionResult | null, formData: FormData) => {
    const result = await action(previous, formData);

    dispatch({ type: "result", result });

    return result;
  }, null);
  const editing = state.mode === "edit";
  const dirty = hasUnsavedChanges(state);
  const errors = state.result?.fieldErrors ?? {};
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const previousMode = useRef(state.mode);
  const formRef = useRef<HTMLFormElement>(null);

  useFocusFirstInvalid(state.result, formRef);

  // Focus follows the mode: first field on "Editar", back to "Editar" on cancel or after saving.
  useEffect(() => {
    if (previousMode.current === state.mode) return;

    previousMode.current = state.mode;
    (editing ? firstFieldRef : editButtonRef).current?.focus();
  }, [editing, state.mode]);

  useUnsavedChangesGuard(dirty);

  /** Checks the browser's own constraints and shows every field that fails at once, with the texts the server would use. */
  function review(event: FormEvent<HTMLFormElement>): boolean {
    event.preventDefault();
    if (isPending) return false;

    const fieldErrors = collectFieldErrors(event.currentTarget, SETTINGS_FIELD_MESSAGES);

    if (Object.keys(fieldErrors).length === 0) return true;

    dispatch({ type: "result", result: { fieldErrors } });

    return false;
  }

  function submit() {
    startTransition(() => formAction(toFormData({ ...state.draft })));
  }

  const publish = usePublishFlow({ state: state.result, review, submit });
  // A site that never saved these texts uses its own: there is no "before" to show.
  const onSite = Boolean(state.saved.tagline || state.saved.description || state.saved.about);

  function field(name: keyof SettingsValues) {
    return {
      name,
      value: state.draft[name],
      readOnly: isPending,
      onChange: (event: { target: { value: string } }) => dispatch({ type: "change", field: name, value: event.target.value }),
    };
  }

  return (
    <FormColumns>
      <Panel aria-label="Textos del sitio">
        {editing ? (
          <form ref={formRef} onSubmit={publish.ask} noValidate className="grid gap-5">
            <Field label="Lema" count={{ length: state.draft.tagline.length, max: 120 }} error={errors.tagline}>
              {(control) => <Input {...control} {...field("tagline")} ref={firstFieldRef} required maxLength={120} />}
            </Field>
            <Field label="Descripción" count={{ length: state.draft.description.length, max: 300 }} error={errors.description}>
              {(control) => <Textarea {...control} {...field("description")} rows={3} required maxLength={300} />}
            </Field>
            <Field label="Acerca de" count={{ length: state.draft.about.length, max: 600 }} error={errors.about}>
              {(control) => <Textarea {...control} {...field("about")} rows={8} required maxLength={600} />}
            </Field>
            <ActionBar status={<FormFeedback state={state.result} />}>
              <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
                {isPending ? "Guardando…" : "Publicar"}
              </Button>
              <Button
                type="button"
                variant="line"
                aria-disabled={isPending || undefined}
                onClick={() => !isPending && dispatch({ type: "cancel" })}
                className="min-h-12"
              >
                Cancelar
              </Button>
            </ActionBar>
          </form>
        ) : (
          <div className="grid gap-5">
            <SettingsReadView values={state.saved} />
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <FormFeedback state={state.result} savedMessage={PUBLISHED_MESSAGE} />
              <Button ref={editButtonRef} variant="line" onClick={() => dispatch({ type: "edit" })}>
                <Icon name="edit" className="size-4" />
                Editar
              </Button>
            </div>
          </div>
        )}
      </Panel>
      {publish.open ? (
        <PublishPreview
          before={onSite ? state.saved : null}
          after={state.draft}
          fields={SETTINGS_PUBLISH_FIELDS}
          render={(shown, changed) => <SettingsPreview values={shown} changed={changed} />}
          {...publish.dialog}
        />
      ) : null}
    </FormColumns>
  );
}
