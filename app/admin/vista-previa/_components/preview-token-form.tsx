"use client";

import { useState } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { ActionResult } from "@/interface/admin/action-result";
import { DEFAULT_PREVIEW_LIFETIME, PREVIEW_LIFETIME_OPTIONS } from "@/interface/admin/preview/preview-lifetimes";

import { Field, FieldError } from "../../_components/form-parts";
import { useControlledForm } from "../../_components/use-controlled-form";

interface PreviewTokenFormProps {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  endpoint: string | null;
}

const INITIAL = { lifetime: DEFAULT_PREVIEW_LIFETIME as string };

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied("yes");
    } catch {
      // No clipboard (insecure context, denied permission): the code stays selectable in the field.
      setCopied("failed");
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <input
          readOnly
          value={code}
          aria-label="Código de vista previa"
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-11 min-w-0 flex-1 basis-72 rounded border border-border bg-card px-3 font-mono text-[0.8125rem]"
        />
        <Button type="button" variant="line" onClick={copy} className="min-h-11">
          <Icon name={copied === "yes" ? "check" : "share"} className="size-4" />
          {copied === "yes" ? "Código copiado" : "Copiar código"}
        </Button>
      </div>
      <p aria-live="polite" className="text-error empty:hidden">
        {copied === "failed" ? "No se pudo copiar. Seleccione el código y cópielo a mano." : null}
      </p>
    </div>
  );
}

export function PreviewTokenForm({ action, endpoint }: PreviewTokenFormProps) {
  const { bind, handleSubmit, state, isPending, errors } = useControlledForm(action, INITIAL);
  // The action also returns the token; the shared form hook types every result as a plain `ActionResult`.
  const token = state && "token" in state && typeof state.token === "string" ? state.token : undefined;
  const expiresAt = state && "expiresAt" in state && typeof state.expiresAt === "string" ? state.expiresAt.replace("T", " ") : undefined;

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <div className="grid gap-x-4 gap-y-5 @xl:grid-cols-2">
        <Field label="Validez del código" hint="Pasado ese tiempo el código deja de funcionar." error={errors.lifetime}>
          {(control) => (
            <Select {...control} {...bind("lifetime")} required>
              {PREVIEW_LIFETIME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
          {isPending ? "Generando…" : "Generar código"}
        </Button>
        <div aria-live="polite" className="min-w-0 text-sm">
          {state?.error ? <FieldError>{state.error}</FieldError> : null}
        </div>
      </div>
      {token ? (
        <div role="status" className="grid gap-3 rounded bg-muted p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-sky">
            <Icon name="check" className="size-4 stroke-[2.25]" />
            Código generado. Cópielo ahora.
          </p>
          <CopyCode code={token} />
          <p className="text-mist">
            Vence el {expiresAt} (hora de Ecuador). No se vuelve a mostrar: si lo pierde, genere otro.
            {endpoint ? ` Se envía en el encabezado X-Preview-Token a ${endpoint}.` : " Se envía en el encabezado X-Preview-Token al endpoint público de vista previa."}
          </p>
        </div>
      ) : null}
    </form>
  );
}
