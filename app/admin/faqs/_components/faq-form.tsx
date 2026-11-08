"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/interface/admin/action-result";

import { ActionBar, Field, FormFeedback } from "../../_components/form-parts";
import { MoreOptions } from "../../_components/more-options";
import { useControlledForm } from "../../_components/use-controlled-form";

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
}

export function FaqForm({ action, submitLabel, initialValues = EMPTY_FAQ_FORM_VALUES }: FaqFormProps) {
  const { values, bind, toggle, handleSubmit, state, isPending, errors } = useControlledForm(action, initialValues);
  const command = bind("command").value.trim();

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
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
      <ActionBar status={<FormFeedback state={state} />}>
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
          {isPending ? "Guardando…" : submitLabel}
        </Button>
      </ActionBar>
    </form>
  );
}
