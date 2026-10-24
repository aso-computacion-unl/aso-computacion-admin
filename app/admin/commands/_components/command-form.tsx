"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/interface/admin/action-result";

import { ActionBar, Field, FormFeedback } from "../../_components/form-parts";
import { Panel } from "../../_components/page-head";
import { useControlledForm } from "../../_components/use-controlled-form";

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
}

export function CommandForm({ action, submitLabel, initialValues = EMPTY_COMMAND_FORM_VALUES }: CommandFormProps) {
  const { bind, toggle, handleSubmit, state, isPending, errors } = useControlledForm(action, initialValues);
  const command = bind("command").value.trim();
  const description = bind("description").value.trim();
  const output = bind("output").value.trim();

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <Field
        label="Comando"
        hint="Una palabra corta: minúsculas, números y guiones, de 2 a 28 caracteres. No puede repetirse ni coincidir con el comando de una pregunta."
        error={errors.command}
      >
        {(control) => (
          <Input {...control} {...bind("command")} required maxLength={28} autoCapitalize="off" autoComplete="off" spellCheck={false} className="font-mono" />
        )}
      </Field>
      <Field label="Descripción" hint="Se muestra junto al comando en la ayuda del terminal. Hasta 80 caracteres." error={errors.description}>
        {(control) => <Input {...control} {...bind("description")} required maxLength={80} />}
      </Field>
      <Field label="Respuesta" hint="Lo que imprime el terminal. Hasta 600 caracteres; puede usar varias líneas." error={errors.output}>
        {(control) => <Textarea {...control} {...bind("output")} rows={6} required maxLength={600} />}
      </Field>
      <Panel aria-labelledby="command-preview-heading" className="grid gap-3">
        <h2 id="command-preview-heading" className="text-lg font-bold font-stretch-[112%]">
          Vista previa
        </h2>
        {command || output ? (
          <div className="grid gap-1 rounded bg-muted p-4 font-mono text-sm">
            <p className="text-sky">❯ {command || "…"}</p>
            <p className="wrap-anywhere whitespace-pre-wrap">{output}</p>
          </div>
        ) : (
          <p className="text-mist">Escriba el comando y la respuesta para ver cómo se lee en el terminal.</p>
        )}
        {command && description ? (
          <p className="font-mono text-[0.8125rem] text-mist wrap-anywhere">
            En la ayuda: {command} — {description}
          </p>
        ) : null}
      </Panel>
      <SwitchField
        label="Publicado"
        description="Los borradores no salen en el sitio. Los cambios llegan al sitio público en su próxima actualización."
        {...toggle("isPublished")}
      />
      <ActionBar status={<FormFeedback state={state} />}>
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
          {isPending ? "Guardando…" : submitLabel}
        </Button>
      </ActionBar>
    </form>
  );
}
