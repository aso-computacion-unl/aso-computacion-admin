"use client";

import { useEffect } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ROLES } from "@/domain/user";
import type { ActionResult } from "@/interface/admin/action-result";
import { ROLE_LABELS } from "@/interface/admin/role-labels";

import { Field, FieldError } from "../../_components/form-parts";
import { useControlledForm } from "../../_components/use-controlled-form";

interface InviteUserFormProps {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
}

const INITIAL = { email: "", name: "", role: "EDITOR" };

export function InviteUserForm({ action }: InviteUserFormProps) {
  const { bind, handleSubmit, reset, state, isPending, errors } = useControlledForm(action, INITIAL);
  const saved = state?.success === true;

  useEffect(() => {
    if (saved) reset();
    // `state` is a new object per submit; `reset` only sets state back to the constants above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <div className="grid gap-x-4 gap-y-5 @xl:grid-cols-3">
        <Field label="Correo" hint="El de la cuenta de Google con la que entrará." error={errors.email}>
          {(control) => <Input type="email" inputMode="email" autoComplete="off" {...control} {...bind("email")} required />}
        </Field>
        <Field label="Nombre (opcional)" hint="Si lo deja vacío se usa la parte inicial del correo." error={errors.name}>
          {(control) => <Input {...control} {...bind("name")} maxLength={120} />}
        </Field>
        <Field label="Rol" error={errors.role}>
          {(control) => (
            <Select {...control} {...bind("role")} required>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" busy={isPending} aria-disabled={isPending || undefined} className="min-h-12">
          {isPending ? "Agregando…" : "Agregar usuario"}
        </Button>
        <div aria-live="polite" className="min-w-0 text-sm">
          {state?.error ? <FieldError>{state.error}</FieldError> : null}
          {saved ? (
            <p role="status" className="flex items-center gap-2 font-semibold text-sky">
              <Icon name="check" className="size-4 stroke-[2.25]" />
              Usuario agregado.
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
