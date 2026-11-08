"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/interface/admin/action-result";

import { ActionBar, Field, FormFeedback } from "../../_components/form-parts";
import { MoreOptions } from "../../_components/more-options";
import { PUBLISHED_MESSAGE, PublishPreview, usePublishFlow } from "../../_components/publish-preview";
import { useControlledForm } from "../../_components/use-controlled-form";
import { FAQ_PUBLISH_FIELDS, FaqPreview } from "./faq-preview";

export interface FaqFormValues {
  question: string;
  answer: string;
  command: string;
  isPublished: boolean;
}

export const EMPTY_FAQ_FORM_VALUES: FaqFormValues = { question: "", answer: "", command: "", isPublished: false };

interface FaqFormProps {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  initialValues?: FaqFormValues;
  /** An edit page of a draft: it saves by itself once the typing stops (never on a create page). */
  autosave?: boolean;
}

export function FaqForm({ action, submitLabel, initialValues = EMPTY_FAQ_FORM_VALUES, autosave = false }: FaqFormProps) {
  const { values, stored, bind, toggle, handleSubmit, review, submit, state, isPending, errors, formRef, autosaveStatus } = useControlledForm(action, initialValues, { autosave });
  const command = bind("command").value.trim();
  // A published question asks first, with the preview; a draft saves as it always did.
  const publishing = values.isPublished;
  const publish = usePublishFlow({ state, review, submit });

  return (
    <form ref={formRef} onSubmit={publishing ? publish.ask : handleSubmit} noValidate className="grid gap-5">
      <Field label="Pregunta" count={{ length: values.question.length, max: 200 }} error={errors.question}>
        {(control) => <Input {...control} {...bind("question")} required maxLength={200} className="text-lg" />}
      </Field>
      <Field label="Respuesta" count={{ length: values.answer.length, max: 1000 }} error={errors.answer}>
        {(control) => <Textarea {...control} {...bind("answer")} rows={6} required maxLength={1000} />}
      </Field>
      <MoreOptions invalid={Boolean(errors.command)} className="@xl:grid-cols-1">
        <Field
          label="Comando (opcional)"
          help="Una palabra corta: minúsculas, números y guiones, de 2 a 28 caracteres. No puede repetirse."
          error={errors.command}
        >
          {(control) => (
            <Input {...control} {...bind("command")} maxLength={28} autoCapitalize="off" autoComplete="off" spellCheck={false} className="font-mono" />
          )}
        </Field>
        {command ? <p className="font-mono text-[0.8125rem] text-mist">❯ git help {command}</p> : null}
      </MoreOptions>
      <SwitchField label="Publicada" {...toggle("isPublished")} />
      <ActionBar status={<FormFeedback state={state} autosave={autosaveStatus} savedMessage={stored.isPublished ? PUBLISHED_MESSAGE : undefined} />}>
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
          {isPending ? "Guardando…" : publishing ? "Publicar" : submitLabel}
        </Button>
      </ActionBar>
      {publish.open ? (
        <PublishPreview
          before={stored.isPublished ? stored : null}
          after={values}
          fields={FAQ_PUBLISH_FIELDS}
          render={(shown, changed) => <FaqPreview values={shown} changed={changed} />}
          {...publish.dialog}
        />
      ) : null}
    </form>
  );
}
