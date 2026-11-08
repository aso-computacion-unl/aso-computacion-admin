"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/interface/admin/action-result";
import { COMMAND_FIELD_MESSAGES } from "@/interface/admin/field-messages";

import { ActionBar, Field, FormFeedback } from "../../_components/form-parts";
import { PUBLISHED_MESSAGE, PublishPreview, usePublishFlow } from "../../_components/publish-preview";
import { useControlledForm } from "../../_components/use-controlled-form";
import { COMMAND_PUBLISH_FIELDS, CommandPreview } from "./command-preview";

export interface CommandFormValues {
  command: string;
  description: string;
  output: string;
  isPublished: boolean;
}

export const EMPTY_COMMAND_FORM_VALUES: CommandFormValues = { command: "", description: "", output: "", isPublished: false };

interface CommandFormProps {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  initialValues?: CommandFormValues;
  /** An edit page of a draft: it saves by itself once the typing stops (never on a create page). */
  autosave?: boolean;
}

export function CommandForm({ action, submitLabel, initialValues = EMPTY_COMMAND_FORM_VALUES, autosave = false }: CommandFormProps) {
  const { values, stored, bind, toggle, handleSubmit, review, submit, state, isPending, errors, formRef, autosaveStatus } = useControlledForm(action, initialValues, { fieldMessages: COMMAND_FIELD_MESSAGES, autosave });
  // A published command asks first, with the preview; a draft saves as it always did.
  const publishing = values.isPublished;
  const publish = usePublishFlow({ state, review, submit });

  return (
    <form ref={formRef} onSubmit={publishing ? publish.ask : handleSubmit} noValidate className="grid gap-5">
      <Field label="Comando" help="Minúsculas, números y guiones, de 2 a 28 caracteres." count={{ length: values.command.length, max: 28 }} error={errors.command}>
        {(control) => (
          <Input {...control} {...bind("command")} required maxLength={28} autoCapitalize="off" autoComplete="off" spellCheck={false} className="font-mono" />
        )}
      </Field>
      <Field label="Descripción" count={{ length: values.description.length, max: 80 }} error={errors.description}>
        {(control) => <Input {...control} {...bind("description")} required maxLength={80} />}
      </Field>
      <Field label="Respuesta" count={{ length: values.output.length, max: 600 }} error={errors.output}>
        {(control) => <Textarea {...control} {...bind("output")} rows={6} required maxLength={600} />}
      </Field>
      <SwitchField label="Publicado" {...toggle("isPublished")} />
      <ActionBar status={<FormFeedback state={state} autosave={autosaveStatus} savedMessage={stored.isPublished ? PUBLISHED_MESSAGE : undefined} />}>
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
          {isPending ? "Guardando…" : publishing ? "Publicar" : submitLabel}
        </Button>
      </ActionBar>
      {publish.open ? (
        <PublishPreview
          before={stored.isPublished ? stored : null}
          after={values}
          fields={COMMAND_PUBLISH_FIELDS}
          render={(shown, changed) => <CommandPreview values={shown} changed={changed} />}
          {...publish.dialog}
        />
      ) : null}
    </form>
  );
}
