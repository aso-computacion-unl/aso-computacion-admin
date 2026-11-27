"use client";

import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { COMMAND_FIELD_MESSAGES } from "@/interface/admin/field-messages";

import { EditorGroup, EditorSplit, SPAN } from "../../_components/editor-split";
import { Field, FormFeedback } from "../../_components/form-parts";
import { PUBLISHED_MESSAGE, PublishPreview, PublishSubmitButton, usePublishFlow, type PublishFormProps } from "../../_components/publish-preview";
import { useControlledForm } from "../../_components/use-controlled-form";
import { COMMAND_PUBLISH_FIELDS, CommandCardPreview, CommandPreview } from "./command-preview";

export interface CommandFormValues {
  command: string;
  description: string;
  output: string;
  isPublished: boolean;
}

export const EMPTY_COMMAND_FORM_VALUES: CommandFormValues = { command: "", description: "", output: "", isPublished: false };

interface CommandFormProps extends PublishFormProps<CommandFormValues> {
  /** A note at the foot of the publish panel (a new command: where it lands in the list). */
  note?: string;
}

export function CommandForm({ action, submitLabel, initialValues = EMPTY_COMMAND_FORM_VALUES, autosave = false, note }: CommandFormProps) {
  const { values, stored, bind, toggle, handleSubmit, review, submit, state, isPending, errors, formRef, autosaveStatus } = useControlledForm(action, initialValues, { fieldMessages: COMMAND_FIELD_MESSAGES, autosave });
  // A published command asks first, with the preview; a draft saves as it always did.
  const publishing = values.isPublished;
  const publish = usePublishFlow({ state, review, submit });

  return (
    <EditorSplit
      formRef={formRef}
      onSubmit={publishing ? publish.ask : handleSubmit}
      preview={<CommandCardPreview values={values} />}
      state={<SwitchField label="Publicado" {...toggle("isPublished")} />}
      note={note}
      status={<FormFeedback state={state} autosave={autosaveStatus} savedMessage={stored.isPublished ? PUBLISHED_MESSAGE : undefined} />}
      submit={
        <PublishSubmitButton isPending={isPending} publishing={publishing} label={submitLabel} className="min-h-12 lg:w-full" />
      }
      dialog={
        publish.open ? (
          <PublishPreview
            before={stored.isPublished ? stored : null}
            after={values}
            fields={COMMAND_PUBLISH_FIELDS}
            render={(shown, changed) => <CommandPreview values={shown} changed={changed} />}
            {...publish.dialog}
          />
        ) : null
      }
    >
      <EditorGroup title="Contenido" purpose="Lo que la terminal del sitio responde">
        <Field label="Comando" help="Minúsculas, números y guiones, de 2 a 28 caracteres." count={{ length: values.command.length, max: 28 }} error={errors.command} className={SPAN.text}>
          {(control) => (
            <Input {...control} {...bind("command")} required maxLength={28} autoCapitalize="off" autoComplete="off" spellCheck={false} className="font-mono" />
          )}
        </Field>
        <Field label="Descripción" count={{ length: values.description.length, max: 80 }} error={errors.description} className={SPAN.text}>
          {(control) => <Input {...control} {...bind("description")} required maxLength={80} />}
        </Field>
        <Field label="Respuesta" count={{ length: values.output.length, max: 600 }} error={errors.output} className={SPAN.row}>
          {(control) => <Textarea {...control} {...bind("output")} rows={6} required maxLength={600} />}
        </Field>
      </EditorGroup>
    </EditorSplit>
  );
}
